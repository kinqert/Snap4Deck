# Snap4Deck

Il codice sorgente è completamente contenuto su ./src con la seguente struttura.

- core: qui si trova il codice con funzioni e classi per la geometria 3D.
- factories: cartella con sole funzioni per la creazione veloce di layer tipici in snap4city.
- layers: cartella contenente tutti i layer personalizzati.
- utils: funzioni helper per la libreria.
- main.js: script per il boundle per webpack.js.

Ogni cartella ha a sua volta un file boundle.js dove vengono definite le funzioni e classi da esportare per poter essere richiamato all esterno della libreria.

## Come utilizzare Snap4Deck

durante l'inizializzazione del widget deve essere creata l'instanza di deck.gl con:

````
map3d = new deck.Deck({
        mapStyle: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
        viewState: currentViewState,
        controller: {
            doubleClickZoom: false,
            inertia: true,
            scrollZoom: {
                smooth: true,
            }
        },
        parent: document.getElementById(`${widgetName}_map3d`),
        effects,
        views: new deck.MapView({
            farZMultiplier: 2.21,
        }),

        layers: [
            layers.terrain,
            layers.roads,
            layers.building,
            ...layers.vehicle,
            layers.tree,
        ],
        
        onWebGLInitialized: (gl) => {
            map3dGL = gl;
        },
        onViewStateChange: ({
            viewState
        }) => {
            clearTimeout(updateTimeout);
            currentViewState = viewState;
            
            $('#compass-div').css('transform', `rotate(${-viewState.bearing}deg)`)
            map3d.setProps({
                viewState: viewState,
            });
            $('#deck-zoom-box').text(parseInt(viewState.zoom));
            reloadPopupDiv();
            return viewState;
        },
        getCursor: () => cursorType,
        getTooltip: (info) => {
            let {
                object
            } = info;
            if (object == null)
                return null;
            var displayedText = "";
            var layer = info.tile ? info.tile.layers[0] : info.layer;
            if (layer instanceof snap4deck.CrestLayer) {
                displayedText += `Traffic density: ${Math.floor(object.density * 100) / 100}`;
            } else if (info.layer instanceof snap4deck.TreeLayer) {
                displayedText += `ID: ${object.properties.ID}</br>`;
                displayedText += `Common Name: ${object.properties.NOME_COMUN}</br>`;
                displayedText += `Tree Species: ${object.properties.SPECIE}</br>`;
                displayedText += `Circumference: ${object.properties.CIRCONF_CM} cm`;
            } else if (layer instanceof deck.LineLayer) {
                displayedText += `Name: ${object.nomeStrada.value}</br>`;
                displayedText += `Type: ${object.highwaytype.value}</br>`;
                displayedText += `Length: ${object.lalunghezza.value}`;
            } else if (object.properties != null) {
                if (object.properties.OBJECTID != null)
                    displayedText += `ID: ${object.properties.OBJECTID}</br>`;
                if (object.properties.name != null)
                    displayedText += `Name: ${object.properties.name}</br>`;
                if (object.properties.address != null)
                    displayedText += `Address: ${object.properties.address}`;
            }
            if (displayedText === "")
                return;
            return object && {
                html: `<p class="hoverName">${displayedText}</p>`,
            };
        },
        onDragEnd: ({
            viewport
        }) => {
            cursorType = 'grab';
        },
        onDrag: ({
            viewport
        }) => {
            if (popupCoord.length != 0) {
                reloadPopupDiv()
            }
            cursorType = 'grabbing';
        },
        onDragStart: ({
            viewport
        }) => {
            manuallyControlled = false;
            cursorType = 'grabbing';
            hideMenu(mapMenuId);
            hideMenu(lightMenuId);
        },
        onClick: (info, event) => {
            hideMenu(mapMenuId);
            hideMenu(lightMenuId);
            if (preventClickEvent) {
                preventClickEvent = false;
                return;
            }
            if (whatifOn) {
                $('#deck-whatif-popup').css('display', 'block');
                $('#deck-whatif-popup').css('top', `${info.y}px`);
                $('#deck-whatif-popup').css('left', `${info.x}px`);
                lastWhatifCoord = info.coordinate;
            }
            if (event.rightButton && event.srcEvent.ctrlKey && event.srcEvent.altKey) {
                benchmarkOn = !benchmarkOn;
                if (benchmarkOn) {
                    console.log('benchmark started');
                } else {
                    console.log('benchmark stopped');
                    download('benchmark.json', JSON.stringify(metrics));
                    metrics = [];
                }
            }
            else if (event.rightButton && event.srcEvent.ctrlKey) {
                console.log(info.coordinate);
            }
        },
        onError: (error, layer) => {
            console.error('Fatal error', error);
            console.error('view state', currentViewState);
            console.error('layers', layers);
            console.error('istance', map3d);
            return true;
        },
    });
````

dove come campi principali al funzionamento della mappa sono:

 - parent: riferimento al div dove viene creato il canvas.
 - views: vista con la quale visualizzare la mappa. Nel nostro caso si usa quella di deck.gl di default MapView.
 - layers: layers iniziali da visualizzare.

più eventuali eventi da gestire.

Per aggiungere un nuovo layer invece esiste una varibile chiamata layers e una funzione chiamata updateLayers che applica gli aggiornamenti e aggiorna la mappa.