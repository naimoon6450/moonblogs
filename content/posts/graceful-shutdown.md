+++
title = 'Graceful Shutdown'
date = 2024-01-31T15:00:22-05:00
draft = false
tags = ["kubernetes", "microservices", "graceful shutdown"]
+++

## Learnings around Graceful Shutdown

I embarked my Microservice journey without knowing about Graceful Shutdown. 

What confused me about it? I didn't understand why it was needed because I didn't understand it in the context of a distributed system. 

In my primitive mental model, a web app was something deployed in a single box, traffic would funnel into it, requests would get served or not, and that was the end of it. Fault tolerance, reliability, resilient architecture, etc. were new concepts that I was exposed to during the journey. Specifically within a Kubernetes environment, graceful shutdown is key to ensuring:

- **Data Integrity and Consistency** -> The state between app shutdown initiation and app shutdown should be accounted for in a reliable way (ie. in flight requests).
- **Resource Cleanup** -> Properly closing our app server, closing db connections, flushing our logs/metrics agent, etc.
- **Zero Downtime Deployments** -> Rolling updates allow a seamless end user experience as traffic will continuously be served while deploying new features and updates.

#### Quick Detour into Signals

When I thought about processes getting terminated I immediately think of `CTRL + C`. This command generates an [interrupt](https://en.wikipedia.org/wiki/Interrupt) , which the OS works with the CPU to interpret and sends the SIGINT [signal](https://en.wikipedia.org/wiki/Signal_(IPC)) to terminate the process.

Here's a high level image of what's going on when sending `CTRL + C` to a terminal window that has a server running on `localhost:3000` (pardon me if I missed any key layers).

![High Level Overview of App Term](/termination_journey.jpeg)

The above is for a simple locally hosted web-app. In a production-grade containerized application deployed on multiple EC2 instances and lives across multiple Kubernetes pods, there are new concerns that arise related to the management of the application, scaling, updates, or system events. Kubernetes pods can [terminate](https://cloud.google.com/blog/products/containers-kubernetes/kubernetes-best-practices-terminating-with-grace) for various reasons such as:

- Updating or Rolling Deployments (ie. terminating pods with older version of app)
- Scaling Down (ie. going from 10 to 5 pods)
- Resource Constraints (ie. reaching peak CPU/Memory)
- Node Failure / Maintenance 
- Health Check Failure
- and more!

Any of the above would result in our application terminating and we need to ensure that the application shuts down cleanly; completes any in-flight requests, save necessary state, and not disrupt service to users.

#### K8s Pod Termination
Kubernetes terminates a pod in 3 phases:
- It starts by sending a `SIGTERM` to the pods. This signal [politely asks](https://www.gnu.org/software/libc/manual/html_node/Termination-Signals.html#index-SIGTERM) a program to terminate.
- After sending the `SIGTERM`, K8s kicks off a grace period (defaults to 30 seconds, but can be [configured](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination)). Your application ideally should handle the `SIGTERM` signal and complete any remaining requests / cleanup operations within the given `terminationGracePeriodSeconds`
- Once the `terminationGracePeriodSeconds` passes, K8's will forcefully shutdown the pods via sending a `SIGKILL`, which would terminate the pod without allowing any further cleanup. `SIGKILL` [can not be handled or ignored](https://www.gnu.org/software/libc/manual/html_node/Termination-Signals.html#index-SIGKILL) by your program.

Here's a high level overview of the application termination process:

![High Level k8s Termination](/k8s_grace_period.jpeg)

K8s has a control plane which can be thought of as the brain that manages the resources at a cluster level. The termination signals initiate here. Zooming in a bit more, K8's also has the concept of a Kubelet. Continuing with the brain analogy, the Kubelet can be thought of as the peripheral nerves that carry out commands of the control plane at the Node level.

Once the Kubelet receives the `SIGTERM`, it notifies the Pods and your application should handle the `SIGTERM` and perform any clean up operations. If the application shuts down before the `terminationGracePeriodSeconds` then the old pods will be deleted and new pods will be spawn. If the application does not shut down before the `terminationGracePeriodSeconds` then the pods will receive the `SIGKILL` and be forcibly shutdown. This will also delete the old pods and spawn new pods.

During the time between the forced shutdown of the app and respawning of new pods, incoming requests from the client will be met with unexpected errors (ie. connection failures, timeouts, service unavailable, etc.) 

#### Graceful Shutdown Implementation
Now that I had a better idea of what Graceful Shutdown was, the next step was how figuring out how an application handles Graceful Shutdown.

In languages such as Python, Ruby, and JavaScript, Graceful Shutdown is implemented in a sequential manner since their concurrency model differs from a language like Go. Moreover, using a well known web server framework may handle Graceful Shutdown for you. 

This may seem like an obvious point, but it was a distinction that further developed my understanding of Go's concurrency model. 

Here are some **VERY SIMPLIFIED** example implementations:

**JavaScript** -> Signal is handled by Event Handlers
```javascript
const express = require('express');
const app = express();
const db = require('./db'); 
const PORT = process.env.PORT

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    db.close(); // Close database connection
    // other cleanup tasks
    process.exit(0)
  });

  // handle scenario when it takes too long to close connections / cleanup
  setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);

});
```

**Ruby** -> Signal is **often** handled in the main execution thread 
```ruby
require 'sinatra'
require 'sinatra/activerecord'

set :database, "sqlite3:example.db"

get '/' do
  "Hello, World!"
end

Signal.trap("TERM") do
  puts "SIGTERM received, shutting down gracefully."
  ActiveRecord::Base.connection.close
  exit
end
```

**Python** -> [Signal is handled in the main execution thread](https://docs.python.org/3/library/signal.html#signals-and-threads)
```python
from flask import Flask
import signal
import sys

app = Flask(__name__)
db_connection = connect_to_database()

@app.route('/')
def hello_world():
    return 'Hello, World!'

def graceful_shutdown(signum, frame):
    print("SIGTERM received, shutting down gracefully.")
    db_connection.close()  # Close database connection
    sys.exit(0)

# Capture SIGTERM
signal.signal(signal.SIGTERM, graceful_shutdown)

if __name__ == '__main__':
    try:
        app.run()
    finally:
        db_connection.close()  # Ensure connection is closed if app exits

```

In all these examples, we observe the synchronous nature of the written code aka the main execution thread is usually responsible for catching the termination signal. 

In Go, however, we have the flexibility to create a separate Go routine that listens for signals. There's nothing really profound here to be honest, but when this clicked for me it felt momentous.