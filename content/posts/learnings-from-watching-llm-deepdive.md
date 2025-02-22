+++
title = "High Level Learnings from Andrej's Deep Dive into LLM"
date = 2025-02-22T11:34:48-05:00
draft = true
+++

Andrej Karpathy is an absolute legend for posting a > [3-hour long video](https://www.youtube.com/watch?v=7xTGNNLPyMI) on the internals of LLMs and specifically ChatGPT.

In this day and age where every little thing is commodified, it's a breath of fresh air to see someone like Andrej post this densely packed gem.

In any case I wanted to write down my own learnings to make the concepts stick.

Before watching the video my understanding of LLMs were that they:
- had a pool of knowledge to make inferences from (unsure what this looked like)
- predicted the next best "character" based on this pool given some probability distribution of weights
- outputted better answers given a refined prompt or if you told it to think slowly step buy step via Chain of Thought (CoT)
- can be given personalities and make it use context specific to that personality
- have a limited context window the LLM can reference (larger the better)
- are more powerful as the # of parameters goes up (no idea what this meant though)



