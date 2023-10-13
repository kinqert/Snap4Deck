export class WorkersPoolManager {
    static workersPoolSet = new Map();

    static initializePool(workerName, nrThread = 8, preprocessing = null) {
        const workerPath = `../widgets/layers/workers/${workerName}-worker.js`;
        const pool = [];
        const queue = [];
        for (let i = 0; i < nrThread; i++) {
            const newWorker = new Worker(workerPath); 
            newWorker.busy = false;
            newWorker.id = i;
            newWorker.key = workerName;
            pool.push(newWorker);
        }
        const workerPool = {
            pool,
            queue,
            preprocessing
        };
        WorkersPoolManager.workersPoolSet.set(workerName, workerPool);
        return workerPool;
    }

    static _searchFreeThread(pool) {
        let index = 0;
        let endTime = Date.now();
        for (let worker of pool) {
            if (!worker.busy)
                return index;
            if (endTime - worker.startTime >= 3000) {
                console.log('cleaning worker out of time', worker);
                worker.terminate();
                return index;
            }
            index++;
        }
        return null;
    }

    static enqueueData(workerPool, data) {
        const freeThreadIndex = WorkersPoolManager._searchFreeThread(workerPool.pool);
        if (freeThreadIndex == null) {
            workerPool.queue.push(data);
        } else {
            const worker = workerPool.pool[freeThreadIndex];
            worker.busy = true;
            worker.startTime = Date.now();
            workerPool.preprocessing(data, worker);
        }
    }

    static getNextQueueElement(workerPool) {
        return workerPool.queue.shift();
    }

    static getWorkerPool(workerName) {
        const workerPool = WorkersPoolManager.workersPoolSet.get(workerName);
        if (!workerPool) {
            console.error('WorkerManager getWorkerPool: no worker pool found with name: %s', worker.key);
            return;
        }
        return workerPool;
    }

    static finish(worker) {
        const workerPool = WorkersPoolManager.getWorkerPool(worker.key);
        const data = WorkersPoolManager.getNextQueueElement(workerPool);
        if (data) {
            worker.startTime = Date.now();
            workerPool.preprocessing(data, worker);
        }
        else
            worker.busy = false;
    }

    static terminatePool(workerPool) {
        for (let worker of workerPool.pool) {
            worker.terminate();
        }
        WorkersPoolManager.workersPoolSet.delete(workerPool.pool[0].key);
    }
}