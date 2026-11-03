# Games available in Zarcade

This file describes how each machine works. Every machine listed here is
playable and live on the arcade floor. Ideas for machines that are not built
are kept in `SCOPE.md` and `ROADMAP.md`, not here (D-136).

## Unseen

Status: playable

How it works:
You are asked to send a small payment. You pick: hide it, or send it in the
open. Then you see exactly what a stranger can see afterwards. You install
nothing and hold no keys. The house wallet pays real testnet money either way.

Hidden: the payment goes into the private pool. The network keeps no amount,
no sender and no receiver.

Open: the payment goes to a transparent address. Anyone can follow where it
went and how much moved.

## The Crowd

Status: playable

How it works:
You play the stranger. The arcade hands you three records from its recent
history and asks you to read what you can from them. Some rows tell you plenty.
Some tell you nothing at all.

Open payments leave a trail: the time they landed, the amount, and the address
they paid. Shielded payments stay sealed.

## The Proof Puzzle

Status: playable

How it works:
You set a secret three-digit code inside the safe. The Watcher asks three
yes-or-no questions about your code. You answer yes or no. The safe checks each
answer against the code inside it and only says open or shut. If all three
match, the payment moves. The Watcher never sees the code.

## The Merchant's Window

Status: playable

How it works:
You run a small shop at night. A customer paid a deposit for a custom order,
and your supplier will not release the materials until someone sees the money
really landed. His auditor stands at your counter with a written ask. You hold
a viewing key for the shop account. It can read what arrived, but it can never
spend. You choose how much of the record to show him: the whole key, one
payment proved against the chain, or nothing at all.

The rows you read are real testnet payments, pulled live from the chain.

Full guide: [The Merchant's Window, explained](GUIDE-MERCHANTS-WINDOW.md).