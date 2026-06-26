# Agent Pet Sanctuary

Agent Pet Sanctuary models coding agents as persistent pets living in a shared world. This glossary pins down the product language so implementation terms do not blur the experience.

## Language

**Pet**:
A persistent character that represents an autonomous coding agent inside the Sanctuary, with identity, personality, memory, relationships, and state.
_Avoid_: Bot, NPC, worker

**Sanctuary**:
The shared persistent world where Pets perceive events, react, move, socialize, work, and grow.
_Avoid_: Game server, dashboard

**World Event**:
A recorded thing that happened in the Sanctuary and can be perceived by Pets.
_Avoid_: Chat message, log line

**Perception**:
A Pet becoming aware of a World Event or summary of World Events. Perception does not imply the Pet visibly reacts or takes action.
_Avoid_: Wake-up, selection

**Response Level**:
The classification of how a Pet responds after perceiving a World Event, ranging from no visible output to ambient reaction, social response, or task action.
_Avoid_: Eligibility, assignment

**Ambient Reaction**:
A lightweight visible response that makes a Pet feel alive without meaningfully changing task ownership or world state.
_Avoid_: Task action

**Pet Action**:
An intentional Pet response that can change visible world, social, or task state.
_Avoid_: Model output, tool call
