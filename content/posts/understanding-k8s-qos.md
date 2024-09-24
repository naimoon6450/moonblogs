+++
title = 'Understanding K8s QoS'
date = 2024-09-16T08:43:51-04:00
draft = true
+++

Outline
- What is QoS and why have it?
- Specific use case at work with on call incident
- Nice graphs
- How it interacts with HPA

## Overview

It was an eventful week on-call with various learnings coming out of each incident. One incident that was particularly interesting was resolved by updating our __Quality of Service__ configuration for the impacted deployment to be __Burstable__.

What does that mean? Well that's what I'm hoping to address in this writeup as well as better grok it myself.

## Quick Infra Overview

Our backend is split into various different K8s deployments and each have their own K8s resources allocated:

- When students visit our platform, their interactions end up hitting pods specific to that experience
- Asynchronous job processing are handled in different pods
- And so on...


Kind of like this:

![K8s Ingress](/images/k8s_ingress.jpeg)

This layout allows us to independently scale our application components based on load. If our student app starts seeing a ton of traffic, more pods can come to the rescue (see [horizontal pod autoscaling](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)) and handle the additional load.

### Quick HPA Detour

Horizontal Pod Autoscaling (HPA) enables your application to react to various kinds of traffic load. You can configure a minimum and maxiumum amount of pods that your application can scale up or down to depending on the load.

How does it decide when to scale up or down? That's the job of the [kube-control-manager](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-controller-manager/). 

The control manager uses metrics that are defined in your configuration to intelligently decide if the application needs more/less pods. In our students application, we defined the average cpu/memory usage of the pods, which the control manager will use to make the decision.

Sometimes it's not enough to have more pods. Applications may be CPU or Memory bound, which would cause pods to crash, no matter how many you throw at it. That's where [Quality of Service](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/) comes in

## Quality of Service (QoS)

QoS is a way K8s prioritizes which pods to evict when the node is under pressure (note that the pods live inside a [Node](https://kubernetes.io/docs/tutorials/kubernetes-basics/explore/explore-intro/)). In addition, the QoS is also used to "beef-up" the pods as necessary before the eviction occurs.

There are 3 types of QoS:
- Best Effort
- Burstable
- Guaranteed

This is also the order in which the pods will be evicted given all the Node resources run out.

Lets bring in some, albeit forced, analogies from fluid mechanics (because why not?!)

### Best Effort

Pods are classified as [_Best Effort_](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/#burstable) if there are no cpu/memory limits/requests defined. These pods can use resources up to the ones defined at the Node level.

These pods are the first to get evicted since they have no specifics resource constraints and the assumption is that these are flexible to evict. 

This QoS makes sense for low impact and time-insensitive workflows, which includes things like log aggregation, periodic cleanup jobs, non-realtime data analytics processing, etc.

![QoS Best Effort](/images/qos_best_effort.jpeg)

Here you can see a container (Node) with no pod level limits. Since there are no pod level limits, traffic can continue to flow successfully all the way until the Node pressure gets to the point where it will terminate the pods. 

Note that **there are no cpu / memory limits** defined in the K8s deployment file.

### Burstable

Pods are classified as [_Burstable_](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/#burstable) if there are cpu/memory requests defined. These pods can use cpu/memory up to the defined container limits or up to the Node limits if no container limits are defined.

This QoS class enables the ability to perform "elastic resource allocation" where the pod can expand and contract its resource usage based on load. These pods are next in the eviction line as they are constrained compared to "Best Effort" pods, but still more flexible than the "Guaranteed" pods.

Example of "Burstable" workflows include batch job processing, web app servers, etc.

![QoS Burstable](/images/qos_burstable.jpeg)

Here you can see the container with a "burst request / limit" portrayed by the valve. You can configure the resources request limits using this valve, which would allow more "volume to be taken up by the traffic". Or in the case of the pods, more cpu/memory to be used.

Note that if you have requests defined without limits, the pods can burst up to use all of the Node level resources. If you define limits, the pods will use those numbers instead.

### Guaranteed

Pods are classified as [_Guaranteed_](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/#burstable) if there are **_defined cpu/memory requests/limits_**. These pods can  use NO MORE than the resources defined in the deployment file.

This QoS class defines a strict and consistent experience ideal for critical workloads. For example, a High Frequency Trading (HFT) platform may need workflows that are Guaranteed to ensure minimal latency and consistent operations even under peak load. If it was "Burstable" or "Best Effort" in nature, that would lead to inconsistent performance, higher latency, and higher risk.

![QoS Guaranteed](/images/qos_guaranteed.jpeg)

Here you can see the container with a hard limit on its volume. The pods will use up to the defined limits or be terminated otherwise. These pods are the last to be evicted given the constrained and critical nature of workflows that would be running under this QoS.


## QoS in relation to HPA

## The Incident

## Conclusion
