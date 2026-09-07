# System: world and rendering

Districts are procedurally generated from `content/districts/*.json` (`scene.generator`, `seed`, `terrain`, `water`, `vegetation`, `landmarks`, `ambience`). One district is resident at a time. Budgets and presets are in `game.config.json`.

## TN-WLD-01 Parliament Hill hub — Implemented

```gherkin
Feature: Hub scene
  Scenario: Hub landmarks are present
    When "hub" is loaded
    Then landmarks centre-block, centennial-flame, flagpole-main, flagpole-west, canal-locks and station exist at their configured positions
    And localized labels appear when I approach ("Centre Block & Peace Tower" / "Édifice du Centre et tour de la Paix")

  Scenario: Spawn
    Then I spawn at [0, 0, 28] facing yaw 3.14159 (towards Centre Block)
    And guide-amelie is idle at [4, 0, 14] and skater-jo wanders within radius 8 of [-52, 0, 20]

  Scenario: Deterministic generation
    Given seed 1867
    When the hub is generated twice
    Then terrain heights and vegetation placements are identical
```

## TN-WLD-02 District streaming — Implemented

```gherkin
Feature: One district at a time
  Scenario: Loading screen during travel
    When 'district:load-requested' is emitted for "history"
    Then [data-screen="loading"] shows "Travelling to Canada's History…"
    And input is ignored until 'district:loaded'

  Scenario: Previous district is disposed
    When "history" finishes loading
    Then the hub's meshes, textures and NPCs are disposed
    And GPU memory reported in 'debug:frame' does not grow across 5 consecutive round trips by more than 10 %
```

## TN-WLD-03 Day/night cycle — Planned

```gherkin
Feature: Day and night
  Scenario: Starts at the district's time of day
    When "who-we-are" loads (ambience.timeOfDay 0.7)
    Then the sun position and sky colour correspond to 0.7 of the cycle

  Scenario: Advances while playing
    Given featureFlags.dayNightCycle is true
    When 10 real minutes pass
    Then timeOfDay has advanced and lamp landmarks emit light after dusk
```

## TN-WLD-04 Weather per district — Planned

```gherkin
Feature: Weather
  Scenario Outline: Ambience weather is applied
    Given featureFlags.weather is true
    When "<district>" loads
    Then the "<weather>" effect is active and fogDensity matches the district file

    Examples:
      | district      | weather |
      | hub           | clear   |
      | symbols       | snow    |
      | modern-canada | rain    |
      | history       | fog     |

  Scenario: Snow terrain
    When "symbols" loads (terrain.snow true)
    Then the terrain palette and ground particles use the snow variant

  Scenario: Weather respects Low preset
    Given preset "low" (volumetricFog false)
    Then fog is applied as distance fog without the volumetric pass
```

## TN-WLD-05 Graphics presets and benchmark — Implemented

```gherkin
Feature: Presets
  Scenario: URL override for tests
    When I open "?preset=low"
    Then renderScale is 0.75, shadowMapSize 1024, bloom false, maxInstances 600

  Scenario Outline: Auto benchmark picks a preset
    Given graphicsPreset "auto"
    When the 2000 ms benchmark measures <fps> fps
    Then preset <preset> is applied

    Examples:
      | fps | preset |
      | 25  | low    |
      | 40  | medium |
      | 70  | high   |
      | 120 | ultra  |
```

## TN-WLD-06 Performance budgets — Planned

```gherkin
Feature: Budgets
  Scenario: Frame rate targets
    Given an RTX 3060-class GPU at 1920x1080 on preset "high"
    Then the hub holds >= 60 fps over a 60 s walk
    Given an Apple M1 or Intel Iris Xe on preset "medium"
    Then the hub holds >= 30 fps over a 60 s walk

  Scenario: Payload budgets (CI)
    Then the initial payload is <= 26214400 bytes
    And hub scene assets are <= 62914560 bytes
    And any district's assets are <= 83886080 bytes
    And the build fails if a budget is exceeded

  Scenario: Time to interactive
    Given a throttled 50 Mbps connection and a cold cache
    When I open the game
    Then "menu-new" is interactive within 8000 ms
```

## TN-WLD-07 Debug overlay — Implemented

```gherkin
Feature: Debug overlay
  Scenario: Hidden by default
    Given featureFlags.debugOverlay is false
    Then "debug-overlay" is absent

  Scenario: Enabled by flag
    Given featureFlags.debugOverlay is true or the URL has ?debug=1
    Then "debug-overlay" shows fps, frameMs, drawCalls, triangles, memoryMb and chunks
    And it updates from 'debug:frame' at most 4 times per second
```

## TN-WLD-08 Structured console telemetry — Implemented

```gherkin
Feature: Telemetry
  Scenario: Every event is logged as JSON
    When any GameEvents event is emitted
    Then a console line "[truenorth] {"type":"<event>","payload":{...}}" is written
    And the payload is JSON-serialisable and contains no functions or DOM nodes
```
