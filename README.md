![All Downloads](https://img.shields.io/github/downloads/jessev14/dnd5e-character-monitor/total?style=for-the-badge)

![Latest Release Download Count](https://img.shields.io/github/downloads/jessev14/dnd5e-character-monitor/latest/CM.zip)
[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fdnd5e-character-monitor&colorB=4aa94a)](https://forge-vtt.com/bazaar#package=dnd5e-character-monitor)

Donations help support updates and new modules!
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/jessev14)

# Fog of War Drawings
This module implements a new drawing layer that lets GM users draw out areas of fog of war. 

The Fog Drawings layer is only accessible to GM users and contains drawings made in the same was as normal drawings. However, drawings made on this layer are displayed differently to player and GM users.

GM users will see the drawing the way they are truly defined in Foundry (left image). Player users will see the drawing as unexplored fog of war on the canvas. Note that this is just a visual representation of the drawing and does not actually function as fog of war, other than hiding the map and tokens in its area. If a GM users hides a Fog of War Drawing, that part of the map will be revealed to players.

GM users can preview the scene from a player's perspective using the control bar toggle. Default colors for the drawings (seen as GM users) can be set in the module settings.

For best results, scenes using Fog of War Drawings should have Token Vision and Fog Exploration disabled. Tokens covered by Fog of War Drawings should still be set to hidden.

## Technical Details

The new drawings layer is an extension of the core drawing layer and behaves essentially the same. When a drawing is created on this layer, it is flagged to indicate it is a Fog of War Drawing.

The module patches `Drawing.refresh` to first check if the current drawing is a Fog of War Drawing. If so, it then draws the drawing elements differently depending if the current user is a GM or player.