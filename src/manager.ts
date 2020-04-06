//Profiler manager

import { 
  IIterator, ArrayExt, iter
} from '@phosphor/algorithm';

import {
    Signal, ISignal
} from '@phosphor/signaling';

import {
  JSONExt
} from '@phosphor/coreutils';

import { 
  Profiler
} from './profiler';

import {
    ServerConnection
} from '@jupyterlab/services';

/**
 * A profiler manager.
 */
export
class ProfilerManager implements Profiler.IManager {
    /**
     * Construct a new profiler manager.
     */
    constructor(options: ProfilerManager.IOptions = {}) {
        this.serverSettings = options.serverSettings || ServerConnection.makeSettings();
        this._readyPromise = this._refreshRunning();
        this._refreshTimer = (setInterval as any)(() => {
            if (typeof document !== 'undefined' && document.hidden) {
                return;
            }
            this._refreshRunning();
        }, 10000);
    }

    /**
     * A signal emitted when the running profilers change.
     */
    get runningChanged(): ISignal<this, Profiler.IModel[]> {
        return this._runningChanged;
    }

    /**
     * Test whether the terminal manager is disposed.
     */
    get isDisposed(): boolean {
        return this._isDisposed;
    }

    /**
     * The server settings of the manager.
     */
    readonly serverSettings: ServerConnection.ISettings;

    /**
     * Dispose of the resources used by the manager.
     */
    dispose(): void {
        if (this.isDisposed) {
            return;
        }
        this._isDisposed = true;
        clearInterval(this._refreshTimer);
        Signal.clearData(this);
        this._models = [];
    }
    
    /**
     * Test whether the manager is ready.
     */
    get isReady(): boolean {
        return this._isReady;
    }

    /**
     * A promise that fulfills when the manager is ready.
     */
    get ready(): Promise<void> {
        return this._readyPromise;
    }

    /**
     * Create an iterator over the most recent running Profilers.
     * 
     * @returns A new iterator over the running profilers.
     */
    running(): IIterator<Profiler.IModel> {
        return iter(this._models);
    }

    /**
     * Create a new profiler.
     * 
     * @param s3path - The S3 Path used to create a new profiler.
     * 
     * @param options - The options used to connect to the profiler.
     * 
     * @returns A promise that resolves with the profiler instance.
     */
    startNew(s3path: string, options?: Profiler.IOptions): Promise<Profiler.IProfiler> {
        return Profiler.startNew(s3path, this._getOptions(options)).then(profiler => {
            this._onStarted(profiler);
            return profiler;
        }); 
    }

    /** 
     * Shut down a profiler by name.
    */
    shutdown(name: string): Promise<void> {
        let index = ArrayExt.findFirstIndex(this._models, value => value.name === name);
        if (index === -1) {
            return;
        }

        this._models.splice(index, 1);
        this._runningChanged.emit(this._models.slice());

        return Profiler.shutdown(name, this.serverSettings).then(() => {
            let toRemove: Profiler.IProfiler[] = [];
            this._profilers.forEach(t => {
                if (t.name === name) {
                    t.dispose();
                    toRemove.push(t);
                }
            });
            toRemove.forEach(s => {this._profilers.delete(s); });
        });
    }

    /**
     * Shut down all profilers.
     * 
     * @returns A promise that resolves when all of the profilers are shut down.
     */
    shutdownAll(): Promise<void> {
        let models = this._models;
        if (models.length > 0) {
            this._models = [];
            this._runningChanged.emit([]);
        }

        return this._refreshRunning().then(() => {
            return Promise.all(models.map(model => {
                return Profiler.shutdown(model.name, this.serverSettings).then(() => {
                    let toRemove: Profiler.IProfiler[] = [];
                    this._profilers.forEach(t => {
                        t.dispose();
                        toRemove.push(t);
                    });
                    toRemove.forEach(t => {this._profilers.delete(t); });
                });
            })).then(() => {return undefined; });
        });
    }

    /**
     * Force a refresh of the running profilers.
     * 
     * @returns A promise that with the list of running profilers.
     */
    refreshRunning(): Promise<void> {
        return this._refreshRunning();
    }

    /**
     * Handle a profiler terminating.
     */
    private _onTerminated(name: string): void {
        let index = ArrayExt.findFirstIndex(this._models, value => value.name === name);
        if (index !== -1) {
            this._models.splice(index, 1);
            this._runningChanged.emit(this._models.slice());
        }
    }

    /**
     * Handle a profiler starting.
     */
    private _onStarted(profiler: Profiler.IProfiler): void {
        let name = profiler.name;
        this._profilers.add(profiler);
        let index = ArrayExt.findFirstIndex(this._models, value => value.name === name);
        if (index === -1) {
            this._models.push(profiler.model);
            this._runningChanged.emit(this._models.slice());
        }
        profiler.terminated.connect(() => {
            this._onTerminated(name);
        });
    }

    /**
     * Refresh the running profilers.
     */
    private _refreshRunning(): Promise<void> {
        return Profiler.listRunning(this.serverSettings).then(models => {
            this._isReady = true;
            if (!JSONExt.deepEqual(models, this._models)) {
                let names = models.map(r => r.name);
                let toRemove: Profiler.IProfiler[] = [];
                this._profilers.forEach(t => {
                    if (names.indexOf(t.name) === -1) {
                        t.dispose();
                        toRemove.push(t);
                    }
                });
                toRemove.forEach(t => {this._profilers.delete(t); });
                this._models = models.slice();
                this._runningChanged.emit(models);
            }
        });
    }

    /**
     * Get a set of options to pass.
     */
    private _getOptions(options: Profiler.IOptions = {}): Profiler.IOptions  {
        return { ...options, serverSettings: this.serverSettings };
    }

    private _models: Profiler.IModel[] = [];
    private _profilers = new Set<Profiler.IProfiler>();
    private _isDisposed = false;
    private _isReady = false;
    private _readyPromise: Promise<void>;
    private _refreshTimer = -1;
    private _runningChanged = new Signal<this, Profiler.IModel[]>(this);
} 
/**
 * The namespace for ProfilerManager statics.
 */
export
namespace ProfilerManager{
    /**
     * The options used to initialize a profiler manager.
     */
    export
    interface IOptions {
        /**
         * The server settings used by the manager.
         */
        serverSettings?: ServerConnection.ISettings;
    }
}