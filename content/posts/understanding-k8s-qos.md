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


Kind of like this

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

Lets bring in some analogies from fluid mechanics (because why else did I get this degree!)

### Best Effort

Think of an open reservoir that can hold any amount of fluid. They don't contain a min or max volume and can hold what you throw at it.
