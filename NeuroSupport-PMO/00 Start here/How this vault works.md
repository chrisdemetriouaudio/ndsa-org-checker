---
title: How this vault works
updated: 2026-10-17
---

# 🧭 How this vault works

> [!info] At a glance
> **What:** the to-do list and history for Neuro Support Checker.
> **Start here:** [[00 Dashboard]].
> **Updated:** 17 Oct 2026

## 🗺️ Where things are

- **[[00 Dashboard]]:** what needs doing now. Open this first.
- **[[Live status]]:** what the daily check found. It writes itself.
- **`10 Phases/`:** one page per chunk of work.
- **[[Backlog & Parked]]:** ideas for later and things on hold.
- **[[Decision Log]]:** what we decided, and why.
- **[[Changelog]]:** what went live, and when.

## 📡 What updates itself

- **Every morning at about 7am**, GitHub runs the check on every website. It is free.
- **It rewrites [[Live status]]** and the "Live" box at the top of the [[00 Dashboard]].
- **Obsidian fetches the changes every 10 minutes** through the Obsidian Git plugin.
- **Don't edit [[Live status]] or the Live box.** The next check overwrites them. Everything else is yours.

## 🔣 What the symbols mean

Each symbol means one thing, on every page.

- 👉 **Your action:** something only you can do.
- 🛠️ **For Claude:** building work Claude does.
- ⏳ **Waiting:** stuck until something else happens.
- 💭 **Later:** an idea, not planned yet.
- 🅿️ **Parked:** deliberately on hold.
- 🔴 **Problem:** something broken, or a service that looks closed.
- ✅ **Done:** finished and checked.

On [[Live status]] only:
- **Status:** 🟢 looks active · 🟡 needs a check · 🔴 likely closed · ⚫ closed.
- **Category ticks:** ✅ fine · 🟡 in question · 🔴 serious · ⚪ not checked yet.
- **Score:** 0 to 100, how sure we are it is still running.

## 📐 Writing rules (for everyone adding to this vault, Claude included)

1. **Same shape on every page.** Top: an "At a glance" box. Then **To do**. Then **Done**, folded away.
2. **Open work first.** Finished items go into the folded ✅ Done box at the bottom.
3. **One task, one line.** Start with a verb in bold. Keep it under about 15 words.
4. **Short sentences.** No paragraph longer than 3 lines. Plain words.
5. **Dates as words.** Write "17 Oct 2026", never "2026-10-17", "today" or "yesterday".
6. **Symbols from the list above only**, with the same meaning every time.
7. **Bold the key words only.** No italics, no capitals for emphasis.
8. **Status is checked, not guessed.** Confirm on the live system before ticking.
9. **After every change that goes live:** update the Dashboard, the phase page, the [[Changelog]], the [[Decision Log]] (if a choice was made) and the [[Backlog & Parked]].

## 🎨 Easier reading

The vault turns on a reading style: bigger text, more space, bigger checkboxes. It lives in `.obsidian/snippets/neurosupport-readable.css`. To switch it off: Settings → Appearance → CSS snippets.
