+++
title = 'Investigating an Out of Memory (OOM) issue in a Go app'
author = 'Naimun Siraj'
summary = 'A deep dive into a Go application memory leak'
tags = ["golang", "kubernetes", "datadog", "problem solving"]
date = 2024-05-14T13:55:01-04:00
draft = false
type = "post"
+++


## Overview

Our infra engineer noticed that an asynchronous worker server for one of our services was crashing with an out of memory (OOM) error. This service was responsible for queuing and processing background jobs. 

Upon examining the datadog logs, there wasn't anything particularly alarming—just a "signal: killed" message. The temporary fix was to allocate more memory to the worker server, but this was a waste of resources and didn't address the root cause.

## Investigation

I initially had a few suspects in mind:

- Our asynq worker was not removing the processed jobs from the queue, causing it to build up over time.
- Back-pressure from the queue was causing the worker to crash.
- A goroutine leak somewhere.

The first two suspects were ruled out fairly quickly since the workers were deleting the jobs within 24 hours and we didn't have that many jobs running concurrently.

That only left me with a goroutine leak. I started by drawing out the application goroutines and how they interacted with each other:

![OOM App GoRoutines](/images/oom_post/oom_app_goroutines.jpeg)

Based on this initial pass at locating the goroutines, I couldn't identify a potential leak since things looked in sync. The `redisWorkerServer` had its own signal listener (ie. listening for SIGTERM) and the main `shutdownListener` also had its own signal listener. Both would terminate if K8s sent a SIGTERM signal.

Where was the mysterious memory leak coming from?

![OOM Mem Usage Dashboard](/images/oom_post/oom_mem_usage_dashboard.jpeg)

## Asking for help

Realizing I needed a fresh perspective, I reached out to the Golang slack channel and provided a [detailed explanation of the issue](https://gophers.slack.com/archives/C02A8LZKT/p1713896332595689). A seasoned gopher suggested using [`pprof`](https://github.com/google/pprof), a powerful profiling tool.

[`pprof`](https://github.com/google/pprof) helps analyze and visualize performance characteristics of your program.

This includes the ability to generate a:
- CPU Profile
- Memory Profile
- Block Profile
- Goroutine Profile

These profiles help identify resource consumption hotspots within the codebase.

## Using pprof

When I initially used pprof, the volume of information was overwheling; memory addresses, stack traces, heap allocations, and more. Luckily pprof has a web interface that makes it easier to navigate through the data. By running `go tool pprof -http=:8080 http://localhost:6060/debug/pprof/heap`, I could see the visual representation of the memory allocations for each code block.

I had many [asynq](https://github.com/hibiken/asynq) tasks that were sending emails as well as utilizing [DogStatsD](https://docs.datadoghq.com/developers/dogstatsd/?code-lang=go&tab=hostagent) to send metrics to Datadog. In pprof, I noticed that there was a suspicious amount of memory being allocated by the `newStatsdBuffer` function. 

![OOM Mem Usage Pprof](/images/oom_post/oom_mem_profile.jpeg)

Upon further inspection, I noticed that we were initializing a new statsd client not only when a job was being processed, but also when the job would retry. When executing the command that kicked off the asynq processing, I noticed that the number of goroutines would increase each time. The old goroutines were not closed properly because we weren't actually closing the statsd client, but rather, only [flushing the buffer](https://stackoverflow.com/a/15042890/24510649) *during app shutdown* via [`.Flush()`](https://github.com/DataDog/datadog-go/blob/master/statsd/statsd.go#L565).

## Solution

The fix was simple. Instead of initializing a new statsd client for each job, we would initialize it upon app startup and reuse it across the application. In addition, we'd [`.Close()`](https://github.com/DataDog/datadog-go/blob/master/statsd/statsd.go#L838) the client upon app shutdown, which would close the connection and flush the buffer. The resulting dashboard was delicious 😋

![OOM Mem Usage Fixed](/images/oom_post/oom_conclusion.jpeg)

The original code was written early in my Go journey, so it was nice to address this inefficiency and learn a new tool in the process.

## Resources

- [Pprof Docs](https://github.com/google/pprof)
- [Matt KØDVB - Profiling](https://www.youtube.com/watch?v=MDB2x1Di5uM&pp=ygURcHByb2YgbWF0dCBnb2xhbmc%3D)