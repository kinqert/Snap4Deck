# Layers

Qui vengono definiti tutti il layer.

# Panoramica

Panoramica dei layers definiti.

| LAYER | TIPOLOGIA | SCOPO |
|---|---|---|
| [building-fusion-tile-layer](/layers/building-fusion-tile-layer.md) | composta | classe che permette la visualizzazione degli edifici con l'ausilio del FusionTileLayer.
| cached-glb-layer | derivata | estende il GLBLayer dove vengono applicati materiali di default.
| crest-layer | base | crea un layer per la visualizzazione del traffico in 3D con un sistema a creste, dove il colore.
| glb-tile-layer | derivata | deriva dal TileLayer dove vengono applicate delle ottimizazione per il rendering di file GLB.
| managed-tile-layer | derivata | simile al glb-tile-layer.
| sensor-3D-layer | composta | layer per la costruzione di pillar per la visualizzazione dei sensori e del loro relativo valore.
| managed-terrain-layer | derivata | estenzione del TerrainLayer con varie ottimizzazioni e il supporto di heatmap e traffic texture blending.
| terrain-mesh-layer | derivata | deriva da ScenegraphLayer e implementa il blending delle texture.
| tree-layer | composta | layer per la visualizzazione di alberi.

### Tipologie:
- Base: layer creato da zero dove ogni aspetto e definito all interno della classe.
- Derivata: layer che deriva da un altro dove ci saranno solo delle minime modifiche al comportamento originale.
- Composta: layer che contiene al suo interno altri layers.