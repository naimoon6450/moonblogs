+++
title = 'A Red Herring Affair'
date = 2024-02-21T21:19:47-05:00
draft = false
tags = ["problem solving"]
summary = "A middle dive into a problem that wasn't what it seemed"
+++

## **Overview**

In the final stages of migrating our marketing website from Dato/Webpress to [Webflow](https://webflow.com/), we encountered an issue with our affiliate tracking process.

## **Issue (as initially understood)**
Conversions from the affiliate link originating from the Webflow URL (ie. `marketing-site.webflow.io`) were not making it to Impact. Conversions coming from the affiliate link originating from our current marketing site (ie. `marketing-site.com`) were making it to [Impact](https://impact.com/partners/affiliate-partners/). 

## **The Journey**
The first 30-45 minutes were spent trying to understand the problem since I familiar with our marketing tools. Our web manager briefed me on the current state of affairs; network errors, tracking scripts not loading, what is data successfully got to Impact. We initially suspected that it was a domain issue and perhaps some domain whitelisting was missing on the relevant platforms (ie. CloudFlare, WebFlow, Impact).

During my initial exploration, I thought that perhaps the Impact script tag wasn't instantiated on the page that is visited after leaving our marketing site. This was quickly disproven since we loaded the script to Google Tag Manager, which should be applied on all of our pages. 

We also noticed that certain query parameters were stripped when going from the marketing site to our platform. This led us to think that maybe it was a networking issue (ie. Nginx). 

The next pivotal question asked was:

> "How do conversions get from the marketing site to Impact?" 

There were 2 paths once the user enters our platform from either the webflow or non-webflow site to purchase a subscription:
- Upon visiting our plan page, a checkout modal automatically appears and the user gets to complete their purchase (this functionality was called Unified Checkout and based on a query parameter).
- Upon visiting our plan page, the user would have to click the "Upgrade" button, the checkout modal appears, and the user gets to checkout.

The other wrench in all this was that the conversion data takes ~2 hours to appear in Impact. This led to slow iterations and more confusion.

Here's a diagram to show all the moving pieces:

![Impact Overview](/images/impact_issue.jpeg)

With all this laid out, several red herrings prolonged the investigation:
- The query params being stripped on top of dealing with cross-domains led to thinking it could be a networking issue (ie. Egress).
	- Our Infra team confirmed there weren't any Egress restrictions that could have impacted our API calls to Impact.
- Impact tag was not loading appropriately on a few pages, but still sent the conversion data.
- Miscommunication on whether the two checkout paths above were tested.

My gut told me it had to do with how we were making the call to Impact or, **spoiler alert**, wasn't making the call. With a few of my teammates, we traced our FrontEnd code to a module that made calls to Impact. This specific module was configured to fire only in the flow where a user clicked on our "Upgrade" button, but not when the modal automatically appeared.

After my teammate incorporated the Impact call when the modal automatically appears, we fired tests and saw the conversion data in Impact!

## **Quick Lessons Learned**

**Understand the flow of data** >> It's important to understand how data flows from one system to another. This includes understanding the user journey and the systems involved in the process. At the end of the day, something was making the API call to Impact and tracing where that was happening was key.

**Red herrings** >> If something seems more complicated than it should be, it probably is. It's important to take a step back and ensure the low hanging fruits are plucked first since they could be easily addressed.

**Collaboration** >> Bringing in a fresh set of eyes can ensure you're not spiraling down the wrong path. With all the red herrings appearing, I doubted my own conclusions even though they were sound.
