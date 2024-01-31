+++
title = 'Graceful Shutdown'
date = 2024-01-31T15:00:22-05:00
draft = true
+++

## Learnings around Graceful Shutdown

I embarked my Microservice journey without knowing about Graceful Shutdown. 

What confused me about it? I didn't understand why it was needed because I didn't understand it in the context of a distributed system. 

In my primitive mental model, a web app was something deployed in a single box, traffic would funnel into it, requests would get served or not, and that was the end of it. Fault tolerance, reliability, resilient architecture, etc. were new concepts that I was exposed to during the journey. Specifically within a Kubernetes environment, graceful shutdown is key to ensuring:

- **Data Integrity and Consistency** -> The state between app shutdown initiation and app shutdown should be accounted for in a reliable way (ie. in flight requests).
- **Resource Cleanup** -> Properly closing our app server, closing db connections, flushing our logs/metrics agent, etc.
- **Zero Downtime Deployments** -> Rolling updates allow a seamless end user experience as traffic will continuously be served while deploying new features and updates.