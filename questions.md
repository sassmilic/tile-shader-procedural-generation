# Questions

I began with a physical pattern block, isolated its fundamental geometric unit, and reconstructed it using only triangles, circles and rectangles. Shader code reflects and repeats a single triangular fragment to produce a continuous ornament. Every few seconds, a handful of numbers change — the radius of a circle, the position of a rectangle, the number of tiles in view — and something new emerges.[^4]

![The triangular fragment the shader repeats by reflection](base-triangle.svg)

What on the surface is an exercise in ornamentation and procedural generation is in fact a small apparatus for philosophical inquiry.[^*]

## Complexity and compression

1. How much complexity can arise from a handful of simple forms and rules?[^1]
2. When something appears random, how can we distinguish genuine randomness from a structure whose rules we have yet to discover?
3. Can every pattern or sequence be compressed? Are there things that admit no simpler description than themselves?[^2]
4. A few numbers change and an entirely new form appears to our eyes. Where does this sense of novelty come from?[^3]
5. Is complexity an intrinsic property of a thing, or does it describe the limitations of the mind attempting to comprehend it?
6. Is the world algorithmic, or is the algorithm simply the means by which we make the world intelligible?[^25]
7. What is the shortest program capable of reproducing this exact image?[^5]
8. Have I understood the pattern because I have succeeded in compressing it? Is understanding a form of compression?[^6]
9. When we compress something, do we arrive at its essence, or merely discard those aspects of it that we consider irrelevant?[^7]
10. Can we conceive of an unorganised structure? Or does the very act of perceiving something constitute an act of organisation?[^8]
11. Where does the discrepancy between mathematical and aesthetic complexity lie?
    A genuinely random image may be almost incompressible, whereas an extraordinarily intricate ornament may be described by a remarkably short program. Yet the ornament may appear considerably richer to us. Perhaps aesthetic complexity resides somewhere between order and disorder, between our ability to anticipate something and its ability to surprise us.[^12]

## Where the artwork resides

12. If a shader has, say, 5 independently adjustable parameters, we might conceive of the artwork as inhabiting a five-dimensional space, each point corresponding to a particular image. The animation is then a trajectory through this space. I am not so much drawing images as designing a space in which images are possible.
13. Where, then, does the artwork reside? In the code, in the space of possible images, in the particular trajectory through that space, or in the image that momentarily appears before the viewer?[^16]
14. Object-oriented ontology says: A thing can't be reduced to its parts (circles, rectangles, code, numbers) or to its effects (what we see). Is the evolving tile pattern an object in its own right, withdrawn from both the code and the eye?[^9]
    On the one hand, there is the notion of understanding as compression: that to understand something is to discover a simpler description of it, to uncover the rules underlying its apparent complexity. On the other hand, object-oriented ontology resists precisely this kind of reduction. Graham Harman argues that an object cannot be exhausted by an account of its constituent parts, nor by its effects, relations or appearances. Something of the object always remains withdrawn.

## Seeing

15. What particular kind of computation is performed by the human eye and the human brain? Are there structures that are immediately apparent to our eyes but difficult to articulate algorithmically?
    Luciana Parisi considers the possibility that machines might develop forms of perception that are not imitations of human perception, but something altogether different: percepts that are algorithmic rather than optical.[^10]
16. Conversely, what structures might be apparent to a computer but inaccessible to human perception?[^17]
17. Symmetry can be described mathematically, but where does its aesthetic significance come from?[^14]
18. The shader makes no explicit distinction between figure and ground. Why does the eye insist upon making one?[^18]
19. Can there be a pattern without a perceiver?

## Creativity and authorship

20. I wrote the rules, the program draws every frame, and you, watching, decide which moments are events. Where does that leave authorship?[^11]
21. Is creativity located in the production of possibilities or in the ability to recognise a possibility as meaningful?
22. If I could not have imagined a particular image before the computer generated it, in what sense did I create it?
23. Does the introduction of an intermediary (e.g. the computer) diminish authorship, or is authorship distributed, like everything else these days?
24. When I draw by hand, am I executing a set of extraordinarily complex instructions whose workings are largely inaccessible to my conscious mind? Is the distinction between manual and computational creation as fundamental as it appears?[^19]

## Shaders and gesture

A shader of this kind can be understood as a function:

*f(x, y, t) → colour*

Space and time are mapped to colour. The function is evaluated independently across the image, pixel by individual pixel. A single set of instructions gives rise to the entire visual field. Quite elegant.[^15]

This also lends programming an unexpectedly gestural quality. A small alteration to the code can transform the entire image, producing forms the artist could have never anticipated. Much like watercolour spreading in incalculable directions across paper, the medium begins to exhibit a behaviour of its own, exceeding the intentions of the artist.[^20]

25. What happens to the distinction between thinking and making when an abstract thought can become a visual object almost instantaneously?

## Ornament and infinity

A geometric ornament has the peculiar capacity to suggest something greater than its physical extent. A fragment of a tessellation implies its continuation beyond the boundaries of the surface upon which it appears. Through repetition, a finite object intimates an infinite mathematical structure. Perhaps this is part of the metaphysical appeal of geometric ornament: the possibility of making the infinite perceptible through the finite.

I am reminded of geometric ornament in Islamic architecture, of Escher's attempts to represent infinity within a bounded surface, and of Hermetic cosmological diagrams in which immense metaphysical ideas are condensed into remarkably simple geometric relationships.[^21]

26. How can a finite object communicate the existence of an infinite structure?
27. Is there something contemplative about watching an image that changes without progressing towards any particular conclusion?[^22]
28. Is there a relationship between the apparent inexhaustibility of geometric ornament and its traditional association with the divine?[^23]

## Alchemy

*Solve et coagula* — dissolve and reconstitute.[^13]

I took a physical pattern apart, reduced it to elementary forms, and devised rules by which those forms could be reassembled. The original ornament has been dissolved into a language of geometry and number, from which it can materialise again in innumerable configurations.

29. Is abstraction a kind of dissolution?
30. What survives the passage from matter to number and back into perceptible form?
31. Does the act of dissolution reveal something essential, or does it destroy something essential?
32. How much of the world could be folded into a single equation?[^24]

[^*]: Ursula K. Le Guin takes up Elizabeth Fisher’s idea of the container as an early cultural tool. The carrier bag gives these questions a precedent in a form that can hold different threads together. Several of the original references came through the bibliographies of Forgotten Languages. [Le Guin, “The Carrier Bag Theory of Fiction”](https://www.ursulakleguin.com/the-carrier-bag-theory-of-fiction) · [Forgotten Languages](https://forgottenlanguages-full.forgottenlanguages.org/)

[^1]: Alan Turing showed how reacting and diffusing chemicals can produce stationary patterns. P. W. Anderson asks when a system made of familiar components needs new principles of description at a larger scale. [Turing, “The Chemical Basis of Morphogenesis”](https://turingarchive.kings.cam.ac.uk/publications-lectures-and-talks-amtb/amt-b-22) · [Anderson, “More Is Different”](https://robotics.cs.tamu.edu/dshell/cs689/papers/anderson72more_is_different.pdf)

[^2]: Fix a universal prefix-free machine and take the first *n* bits of its halting probability Ω. The shortest program that outputs those bits can save at most a fixed number of bits, however long a prefix we take. Chaitin’s example gives a precise sense in which a sequence can resist compression. [Chaitin, “Epistemology as Information Theory”](https://arxiv.org/abs/math/0506552)

[^3]: Mark Bedau calls a behaviour weakly emergent if it follows from a system’s rules and can be derived only by simulating the system. The tile gives a place to ask why some consequences of familiar rules still look surprising when they appear. [Bedau, “Weak Emergence”](https://people.reed.edu/~mab/papers/weak.emergence.ab.htm)

[^4]: The animation nudges shape parameters within bounds, sometimes resets them to their starting values, and also changes the zoom. The changing values make the distinction between a limited set of rules and a long succession of images visible. [Animation source](https://sassmilic.github.io/tile-shader-procedural-generation/animate.js) · [Bedau et al., “Open Problems in Artificial Life”](https://authors.library.caltech.edu/records/qjbd9-wyf80)

[^5]: The on-screen counter measures the bytes of displayed shader source. Reproducing an exact frame also involves fixing the resolution, renderer and inputs. Kolmogorov complexity asks for the shortest complete program for a specified output in a chosen computational model. Forgotten Languages gives the idea a fictional turn through an AI that finds human life stories suspiciously easy to compress. [Li and Vitányi, *An Introduction to Kolmogorov Complexity and Its Applications*](https://link.springer.com/book/10.1007/978-3-030-11298-1) · [Forgotten Languages, “The Signal and the Soul”](https://forgottenlanguages-full.forgottenlanguages.org/2026/04/the-signal-and-soul-secret-history-of.html)

[^6]: Chaitin treats a scientific theory as a description that compresses its observations. Schmidhuber places pleasure in the improvement of compression, the moment when something previously puzzling yields a regularity. [Chaitin, “Epistemology as Information Theory”](https://arxiv.org/abs/math/0506552) · [Schmidhuber, “Formal Theory of Creativity, Fun, and Intrinsic Motivation”](https://arxiv.org/abs/0812.4360)

[^7]: Shannon’s work on lossy coding makes the choice of what matters explicit through a fidelity criterion. A coding system can give a shorter account of a source at the cost of distortion measured against that criterion. [Shannon, “Coding Theorems for a Discrete Source With a Fidelity Criterion”](https://gwern.net/doc/cs/algorithm/information/1959-shannon.pdf)

[^8]: For Dennett, compression provides a way to identify a real pattern in data. Wertheimer asks how elements of a visual field come to be seen together in the first place. The wording about unorganised structure comes from the epigraph to a Forgotten Languages story. [Dennett, “Real Patterns”](https://dl.tufts.edu/concern/pdfs/wp988x11s) · [Wertheimer, “Laws of Organization in Perceptual Forms”](https://psychclassics.yorku.ca/Wertheimer/Forms/forms.htm) · [Forgotten Languages, “Collision of symbolic systems”](https://forgottenlanguages-full.forgottenlanguages.org/2026/11/collision-of-symbolic-systems-deep-into.html)

[^9]: Graham Harman calls explaining a thing entirely through its parts *undermining* and explaining it entirely through its effects or appearances *overmining*. Timothy Morton pursues the implications of object-oriented ontology for art and causation. [Harman, *Object-Oriented Ontology*](https://www.penguin.co.uk/books/295720/object-oriented-ontology-by-harman-graham/9780241269152) · [Morton, *Realist Magic*](https://openhumanitiespress.org/books/titles/realist-magic/)

[^10]: Parisi considers the kinds of percepts predictive learning might produce. Geirhos and colleagues tested how people and particular trained vision models weigh shape and texture when those cues point to different classifications. [Parisi, “Xeno-Patterning”](https://scholars.duke.edu/publication/1482698) · [Geirhos et al., “ImageNet-trained CNNs are biased towards texture”](https://arxiv.org/abs/1811.12231) · [Forgotten Languages, “Xenosemantics”](https://forgottenlanguages-full.forgottenlanguages.org/2024/11/xenosemantics-artilects-and.html)

[^11]: In “The Creative Act,” Marcel Duchamp makes the spectator part of the work’s completion. Harold Cohen’s AARON offers an example in which an artist designs a program that goes on to make drawings. [MoMA on audience participation and Duchamp](https://www.moma.org/momaorg/shared/flattened_pages/moma_learning/themes/media-and-performance-art/participation-and-audience-involvement/) · [Whitney Museum, Harold Cohen and AARON](https://whitney.org/exhibitions/harold-cohen-aaron/art)

[^12]: Philip Galanter applies the idea of effective complexity to generative art, with room for structure between regularity and randomness. The slight deviations in Vera Molnár’s *Interruptions* give this argument something to look at. Schmidhuber’s “Low-Complexity Art” takes the short program as an artistic constraint in its own right. [Galanter, “What Is Generative Art?”](https://philipgalanter.com/downloads/ga2003_paper.pdf) · [Toledo Museum of Art, Molnár’s *Interruptions*](https://infiniteimages.toledomuseum.org/artwork/interruptions) · [Schmidhuber, “Low-Complexity Art”](https://people.idsia.ch/~juergen/locoart/)

[^13]: The alchemical maxim describes dissolving a substance and forming it again. Emblem XXI in Michael Maier’s *Atalanta fugiens* puts a circle, square and triangle inside an enclosing circle, giving that idea a concrete geometry. [Princeton University Library, “Prime Matter”](https://dpul.princeton.edu/alchemy/feature/prime-matter) · [Science History Institute, Emblem XXI](https://digital.sciencehistory.org/works/wp988k73q) · [Adam McLean, *The Alchemical Mandala*](https://redwheelweiser.com/book/alchemical-mandala-9781890482954/)

[^14]: Repeated reflections of the base triangle give the tile its symmetry. In an experiment with novel graphics, Thomas Jacobsen and Lea Höfel found symmetry was the strongest average predictor of aesthetic judgement, with considerable variation among viewers. Pierre Curie’s work on symmetry in physical phenomena gives the mathematical idea a different setting. [Jacobsen and Höfel, “Aesthetic judgments of novel graphic patterns”](https://pubmed.ncbi.nlm.nih.gov/12509172/) · [Curie’s 1894 paper](https://fondationlouisdebroglie.org/AFLB-193/CURIE.TEX2.pdf)

[^15]: Fragment shaders compute a colour for each fragment using its position and inputs shared across the image. In this piece those inputs include time, resolution and the current shape parameters. [*The Book of Shaders*, “Uniforms”](https://thebookofshaders.com/03/) · [Iñigo Quilez, “2D Distance Functions”](https://iquilezles.org/articles/distfunctions2d/)

[^16]: In *{Software} Structures*, Casey Reas began with three written instructions inspired by Sol LeWitt and worked with other artists to express them in multiple software implementations. The Whitney preserves both the written structures and the resulting works. [Reas, *{Software} Structures*](https://artport.whitney.org/commissions/software-structures-2016/text.html) · [Whitney Museum collection](https://whitney.org/collection/works/23923)

[^17]: In controlled image-classification experiments, Andrew Ilyas and colleagues found that models were able to exploit predictive image features that people had difficulty recognising. [Ilyas et al., “Adversarial Examples Are Not Bugs, They Are Features”](https://dspace.mit.edu/entities/publication/bced0119-c6bc-484a-a46f-4e3c1c261dea)

[^18]: Edgar Rubin’s vase shows how the same boundary can belong to a central vessel or to faces in profile. The tile’s shader computes a distance field and colours it, leaving the eye to organise the result. [Carlsberg Foundation on Rubin’s vase](https://www.carlsbergfondet.dk/en/anniversary-stories/the-psychologist-behind-the-vase/) · [Tile shader source](https://sassmilic.github.io/tile-shader-procedural-generation/pattern.frag)

[^19]: Vera Molnár began with what she called a *machine imaginaire*, carrying out rules with pencil and paper. Her artist statement describes the computer as expanding the set of images she could try, with selection still part of her work. [Molnár, “Inconceivable Images”](https://digitalartmuseum.org/molnar/biog3.html)

[^20]: Helen Frankenthaler drew on the way watercolour pools and spreads when she developed her soak-stain technique. In a later interview she asks whether the directness she valued in painting could carry over to computer art. [MoMA, Helen Frankenthaler](https://www.moma.org/collection/artists/1974) · [Frankenthaler interview](https://www.theartnewspaper.com/2000/05/31/now-seventy-two-frankenthaler-describes-the-experience-and-occasional-joy-of-painting-abstractions)

[^21]: Escher made a watercolour and ink copy of an Alhambra mosaic in 1922. Much later, in *Circle Limit IV*, figures shrink as they approach a circular boundary. Princeton’s alchemy exhibition includes Robert Fludd’s geometrical diagrams of the cosmos. [The Met, “Geometric Patterns in Islamic Art”](https://www.metmuseum.org/essays/geometric-patterns-in-islamic-art) · [Escher’s Alhambra study](https://www.escherinhetpaleis.nl/en/about-escher/escher-today/wall-mosaic-in-the-alhambra) · [National Gallery of Art, *Circle Limit IV*](https://www.nga.gov/artworks/61282-circle-limit-iv) · [Princeton, “Depicting the Great Work”](https://dpul.princeton.edu/alchemy/feature/depicting-the-great-work)

[^22]: Brian Eno describes *77 Million Paintings* as a continuously varying work without a prescribed narrative. His account offers a parallel for watching an image that gives each moment room to matter. [Eno interview](https://www.wired.com/2007/07/interview-brian-eno-on-full-transcript/)

[^23]: The Ardabil Carpet offers a specific setting for this question. Its central medallion, repeating ornament and suspended lamps appear in a work believed to have been commissioned for a shrine. [Victoria and Albert Museum, “The Ardabil Carpet”](https://www.vam.ac.uk/articles/the-ardabil-carpet)

[^24]: In §6 of the *Discourse on Metaphysics*, Leibniz imagines writing an equation for a line drawn in a single, apparently erratic stroke. The example asks how a rule can account for the marks we see. [Leibniz, *Discourse on Metaphysics*, §6](https://earlymoderntexts.com/assets/pdfs/leibniz1686d.pdf)

[^25]: Hector Zenil considers whether simple algorithms might underlie apparent complexity in the world. Luciano Floridi distinguishes digital ontology from the use of digital descriptions at a chosen level of abstraction. [Zenil, “The World Is Either Algorithmic or Mostly Random”](https://arxiv.org/abs/1109.2237) · [Floridi, “Against Digital Ontology”](https://doi.org/10.1007/s11229-008-9334-6)
