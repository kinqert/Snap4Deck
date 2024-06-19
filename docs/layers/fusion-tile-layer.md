# Fusion Tile Layer
Il fusion tile layer è stato sviluppato per rimpiazzare il default tile layer fornito da deck.gl.
Il vantaggio principale del fusion tile layer confronto il tile layer standard è quello di muovere tra i vari tile padri e figli i dati già caricati e di evitare conseguentemente chiamate inutili al server evitandolo si sovraccaricare indipendetemente dalla mole di dati.

Per fare cio il fusion tile layer deve saper come trattare i dati nel passaggio bottom-up e top-down, ovvero la suddivisone che deve avere durante il passaggio da padre a figli e viceversa. Questo avviene passando come proprietà queste due funzioni; il top-down avra come ingresso i dati padre, gli eventuali dati del figlio, e un indice che indica che tile figlio sia, in modo tale da poter ottenere la bounding box del figlio, cosi da poter decidere queli dati vanno dal padre al figlio. Mentre per quanto riguarda il bottom-up avrà solamente i dati del figlio e gli eventuali dati del padre, senza avere un indice in quanto tutti i dati dovranno essere passati al padre. 

Al interno del file sono già presenti due tipi standard funzioni, bottom-up e top-down per dati con una tipologia standard, ovvero geojson e json. per il json deve essere fornita anche un altra funzione ulteriore per sapere come ottenere le cordinate per una certa feature. Per esempio:

````
    getFusionCoords: (d) => d.positions,
````

Inoltre sono presenti vari altri parametri tra cui il deepload e l'offset-load. Il deepload e un intero che fa riferimento lo zoom al quale devono essere caricati i dati. Per esempio se siamo in una tile a zoom 17, ma il deepload è stato impostato ad 18, allora la chiamata originale a zoom 17 verra suddivisa in quattro parti e poi composta assieme tramite sempre la chiamata di bottom-up. Questo serve per ottenere dei dati che sono presenti solo ad un determinato zoom, per esempio gli edifici sono suddivisi in una cartella a zoom 16 quindi devono essere richiamati tramite questa opzione.
Mentre per quanto riguarda l'offset-load la chiamata non viene suddivisa in più parti ma viene chiesto al server di avere una risoluzione a quel determinato zoom, per esempio con il crest layer, viene impostato un offset-load di 17 per ottenere tutte le strade contenute nella tile.

I parametri iniziali sono definiti così:

````
const defaultProps = {
    ...TileLayer.defaultProps,
    TilesetClass: Tileset2DCentered,
    fusionBottomUP: { type: 'function', value: geojsonFusionBottomUp, compare: false },
    fusionTopDown: { type: 'function', value: geojsonFusionTopDown, compare: false },
    fusionPeer: { type: 'function', value: null, compare: false },
    deepLoad: { type: 'number', value: null, compare: false },
    updateCommonState: { type: 'function', value: null, compare: false },
    offsetLoad: { type: 'number', value: null, compare: false },
    statePasstrough: { type: 'bool', value: false, compare: false },
    getFusionCoords: { type: 'function', value: null, compare: false },
    maxTiles: { type: 'number', value: null, compare: false },
    minTileZoom: { type: 'number', value: null, compare: false },
    maxTileZoom: { type: 'number', value: null, compare: false },
    maxOffsetZoom: { type: 'number', value: 0, compare: false },
}
````

Tutto il processo di bottom-up e top-down avviene nella funzione di getTileData, la quale viene chiamata quando un layer fa la richiesta per i dati di una particolare tile, quindi verifica se ci sono attualmente dei dati in cache se no fa una chiamata al server per ottenere dati nuovi. Si può vedere la logica dietro tramite questo grafico.

![flow diagram](../img/flow.svg)

Inoltre qui si può osservare un tipico caso in ordine temporale.

![sequence diagram](../img/sequence.svg)

