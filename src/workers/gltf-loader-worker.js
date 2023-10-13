import { load } from '@loaders.gl/core';
import { GLTFLoader } from '@loaders.gl/gltf';

var controller;

onmessage = (message) => {
    const {action, arrayBuffer} = message.data;
    if (action === 'start') {
        controller = new AbortController();
        const signal = controller.signal;
        load(arrayBuffer, GLTFLoader, {fetch: {signal}}).then((result) => {
            if (!signal.isAborted)
                postMessage(result);
        });
    } else {
        controller.abort();
    }
}