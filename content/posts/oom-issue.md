+++
title = 'Investigating an OOM issue for a Go app'
date = 2024-05-14T13:55:01-04:00
draft = true
type = "post"
+++


## Overview

Our infra engineer noticed that an asynchronous worker server for one of our services was crashing with an out of memory (OOM) error. This service was responsible for queuing and processing background jobs. 

Upon looking at the datadog logs, there wasn't anything particularly alarming / the log wasn't too helpful, just a "signal: killed" message.

## Investigation

I initially had a few suspects in mind:

- Our asynq worker was not removing the processed jobs from the queue and it was building up over time
- Back-pressure from the queue was causing the worker to crash
- A goroutine leak somewhere

The first two suspects were rules out fairly quickly since the workers were deleting the jobs within 24 hours and we didn't have that many jobs running concurrently.

Now to find where the memory was being munched up. I started by drawing out the application goroutines and how they interacted with each other:

![OOM App GoRoutines](/images/oom_app_goroutines.jpeg)

Based on this initial pass at locating the goroutines, I couldn't figure out if there was a potential leak since things looked in sync. The redisWorkerServer had its own signal listener (ie. listening for SIGTERM) and the main shutdownListener also had its own signal listener. Both would close if K8s sent a SIGTERM signal.

Where was the mysterious memory leak coming from?

![OOM Mem Usage Dashboard](/images/oom_mem_usage_dashboard.jpeg)

## Asking for help

I mustered up the courage to post on the Golang #newbies slack channel and provided a detailed explanation of the issue. A fellow gopher was kind enough to point me to the wonderful tool called `pprof`.
