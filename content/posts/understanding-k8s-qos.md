+++
title = 'Understanding K8s Quality of Service (QoS)'
date = 2024-09-16T08:43:51-04:00
draft = false
type = "post"
tags = ["microservices", "kubernetes", "oncall"]
author = "Naimun Siraj"
+++

## Overview

My recent on-call shift was quite the rollercoaster, but I came out of it with many learnings (as usual). One particularly interesting incident was resolved by updating our __Quality of Service__ configuration for the impacted deployment to __Burstable__.

What does that mean? Well that's what I'm hoping to address in this writeup as well as better grok it myself.

## Quick Infra Overview

Our backend is divided into various K8s deployments, each with its own allocated resources:

- When students visit our platform, their interactions are handled by specific pods.
- Asynchronous job processing is handled in different pods.
- And so on...


Kind of like this:

![K8s Ingress](/images/k8s_ingress.jpeg)

This layout allows us to scale our application components independently based on load. If our student app experiences high traffic, more pods can come to the rescue (see [horizontal pod autoscaling](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)) and handle the additional demand.

### A Brief Look at HPA

Horizontal Pod Autoscaling (HPA) enables your application to react to various types of traffic load. You can configure a minimum and maximum number of pods that your application can scale up or down to, depending on the load.

How does it decide when to scale up or down? That's the job of the [kube-control-manager](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-controller-manager/). 

The control manager uses metrics that are defined in your configuration to decide if the application needs more/less pods. In our students application, we defined the average cpu/memory usage of the pods, which the control manager will use to make the decision.

However, sometimes adding more pods isn't enough. Applications may be CPU or Memory bound and reaching those limits would cause pods to crash, regardless of how many are added. That's where [Quality of Service](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/) comes into play.

## Quality of Service (QoS)

QoS is a way K8s prioritizes which pods to evict when the node is under resource pressure (note that the pods live inside a [Node](https://kubernetes.io/docs/tutorials/kubernetes-basics/explore/explore-intro/)). In addition, the QoS is also used to "beef-up" the pods as necessary before the eviction occurs.

There are 3 types of QoS, listed in order:
- Best Effort
- Burstable
- Guaranteed

Let's bring in some, albeit forced 😂, analogies from fluid mechanics (because why not?!)

### Best Effort

Pods are classified as [_Best Effort_](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/#burstable) if there are no cpu/memory limits/requests defined. They can use resources up to the limits set at the node level.

These pods are the first to get evicted since they have no specific resource constraints and the assumption is that they are flexible to evict. 

This QoS is suitable for low impact and time-insensitive workflows like log collection or periodic cleanup jobs.

![QoS Best Effort](/images/qos_best_effort.jpeg)

Here you can see a structure (node) with no pod level limits (volume). Since there are no pod level limits, water can continue to flow until the max volume is reached. In K8s, this is equivalent to increasing node pressure, to the point where the pods get terminated.

Note that **there are no cpu / memory limits** defined in the K8s deployment file.

### Burstable

Pods are classified as [_Burstable_](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/#burstable) if there are cpu/memory requests defined. These pods can use cpu/memory up to the defined container limits or up to the Node limits if no container limits are defined.

This QoS allows for "elastic resource allocation" where the pod can expand and contract its resource usage based on load. These pods are next in the eviction line as they are constrained compared to "Best Effort" pods, but still more flexible than the "Guaranteed" pods.

Example of "Burstable" workflows include batch job processing and web app servers.

![QoS Burstable](/images/qos_burstable.jpeg)

Here you can see the container with a "burst request / limit" portrayed by the valve. You can configure the resources request limits using this valve, which would allow more "volume to be taken up by the water". Or in the case of the pods, more cpu/memory to be used.

Note that if you have requests defined without limits, the pods can burst up to use all of the node level resources. If you define limits, the pods will use those numbers instead.

### Guaranteed

Pods are classified as [_Guaranteed_](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/#burstable) if there are **_defined cpu/memory requests/limits_**. These pods can  use NO MORE than the resources defined in the deployment file.

This QoS class defines a strict and consistent experience ideal for critical workloads. For example, a High Frequency Trading (HFT) platform may need workflows that are Guaranteed to ensure minimal latency and consistent operations even under peak load. If it was "Burstable" or "Best Effort" in nature, that would lead to inconsistent performance, higher latency, and higher risk.

![QoS Guaranteed](/images/qos_guaranteed.jpeg)

Here you can see the container with a hard limit on its volume. The pods will use up to the defined limits or be terminated otherwise. These pods are the last to be evicted given the constrained and critical nature of workflows that would be running under this QoS.

## The Incident

During our incident, our student-app pods were crashing due to reaching cpu limits. We had HPA in place, but it failed to scale up due to the metric we were using.

Our HPA uses cpuAverageUtilization and memoryAverageUtilization to decide if we should scale the pods up, but this calculation was skewed, preventing the HPA from adding more pods.

To resolve the issue, we updated the deployment config to have a Burstable QoS by setting the cpuRequests attribute. This allowed the application to access additional cpu up to the node limit.

![Github CPU Req Update](/images/cpu_request_gh_update.jpeg)

## Conclusion

It's absolutely fascinating that we have such fine-grained control over the "adaptability" of our application. There are definitely some gaps in my understanding here, but hoping I can plug them shut as I continue engaging with K8s.

P.S. During my descent into the QoS/HPA rabbit hole, I found this fantastic chart from Natan Yellin in this [reddit thread](https://www.reddit.com/r/kubernetes/comments/wgztqh/for_the_love_of_god_stop_using_cpu_limits_on/) that sums up the state of your pod based on the defined requests/limits.

P.S.S. The analogies are ROUGH. I really wanted to box K8s concepts into fluid mechanics somehow and the result was the above haha.

![Natan CPUMem Chart](/images/natan_chart.jpeg)
[_source_](https://home.robusta.dev/blog/stop-using-cpu-limits?nocache=234#data-fancybox-2)