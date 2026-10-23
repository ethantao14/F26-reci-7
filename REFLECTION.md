# Reflection

**Name / Andrew ID:** Ethan Tao / etao

**Recitation group members (Task 2):** Zdenek Kotva, Tiffany Liu, Lynsey Li

---

### 1. Valid but weak

Pick a property you wrote that passes on the correct implementation but
kills few or no mutants. Why is it still a *valid* property? Describe a
concrete bug (not one of our mutants) that it *would* catch.

The property "returns exactly five colors" passes on the correct code but does not kill any mutants by itself, since every mutant still returns five colors. It is still valid because the spec says the function always returns one color per letter of the guess, so any correct version has to pass it. It would catch a bug like a loop that stops one letter early and only returns four colors.

### 2. A generator problem, not a property problem

Describe a mutant, from either task, that survived or was flaky because of
your **generator** rather than your property. What did the generator fail to
produce? How did you fix it? Paste the runner output from before and after.

The singlePass mutant was flaky with my "never credits a letter more times than the secret contains it" property. The property was fine, but my generator used all 26 letters, so random words almost never had repeated letters, which is what the bug needs. I fixed it by only using the letters A, B, and C so almost every pair of words has repeats. Before the fix the runner printed "singlePass flaky: killed in 4/5 runs" and "Mutation score: 3/5 killed (60%)". After the fix it printed "singlePass killed by: never credits a letter more times than the secret contains it" and "Mutation score: 4/5 killed (80%)".

### 3. Reading a counterexample

Paste one counterexample that the mutation runner printed for a killed
mutant. In 2–3 sentences, explain using the *specification* why that input
exposes the bug.

The runner printed "Counterexample: ["AAAAB","AAACA"]" and "AssertionError: expected 'B' to be 'Y'" for the greensOnly mutant. The secret is AAAAB and the guess is AAACA, so the first three letters are green. The last A in the guess is in the wrong spot, but the secret still has an unused A, so the spec says it should be yellow. The greensOnly mutant never gives yellows, so it marks it black instead.

### 4. Your project

Name one function or module in your team's project that would benefit from
property-based testing. State two properties in English, name the pattern of
each, and describe the generator you'd need, including anything about its
inputs that a naive generator would get wrong.

In our OpenCode project, I would test searchPattern in file_relations.ts, which I wrote for my file_relations tool. It builds the search pattern used to find files that import a given file. One property (conditional) is that if a quoted import path ends in the file's name, like "./en" for a file named en, the pattern should match it. Another property (invariant) is that it should never match a path where the name is only part of a longer name, like "./entry". The generator would need to build these import paths on purpose, since random strings would almost never contain the file name. It should also use file names with special characters like a dot, since a naive generator with only letters would never check that those are handled correctly.
