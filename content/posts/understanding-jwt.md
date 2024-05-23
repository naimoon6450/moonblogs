+++
title = 'Understanding Jwt'
date = 2024-05-15T14:57:40-04:00
draft = true
type = "post"
+++

## Musing

While working on our checkout service, I noticed that we used JWTs to authenticate client side requests. A co-worker asked a question about how JWT works and that got me spiraling down the rabbit hole.

My initial understanding was that there JWT's were used to tell the backend server that the request being made was made by a trusted party (ie. logged in user). Traditionally, a user is identified via cookies and sessions, but that is a stateful solution where the session data gets stored in the server and adds additional complexity.

In our architecture, I understood that the backend generates a token using a private key stored in AWS Key Management Service, which is then authenticated in our checkout service, but the underlying process was still nebulous. Specifically, it was unclear to me how the public key was used to determine that the token was coming from the right place.

## Taking a Step Back

There are a few pre-requisite items to be familiar with that would solidify one's understanding of the JWT authentication mechanism.

- Encoding
- Hashing
- Encryption/Decryption with Public/Private keys

### Encoding