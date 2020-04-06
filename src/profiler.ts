
import { 
  each, map, toArray, IIterator
} from '@phosphor/algorithm';

import {
  IDisposable
} from '@phosphor/disposable';

import {
  JSONObject
} from '@phosphor/coreutils';

import {
  URLExt
} from '@jupyterlab/coreutils';

import {
    Signal, ISignal
} from '@phosphor/signaling';

import {
    ServerConnection
} from '@jupyterlab/services';

/**
 * The url for the profiler service. profiler 
 * service provided by jupyter_profiler.
 * ref: https://github.com/lspvic/jupyter_profiler
 * Maybe rewrite the jupyter_profiler service by myself.
 */
const PROFILER_SERVICE_URL = '/jupytersmprofiler/api/profiler';

const PROFILER_URL = '/jupytersmprofiler/profiler';

/**
 * The namespace for Profiler statics.
 */
export
namespace Profiler {
    /**
     * An interface for a profiler.
     */
    export
    interface IProfiler extends IDisposable {
        /**
         * A signal emitted when the profiler is shut down.
         */
        terminated: ISignal<IProfiler, void>;

        /**
         * The model associated with the profiler.
         */
        readonly model: IModel;

        /**
         * Get the name of the profiler.
         */
        readonly name: string;

        /**
         * The server settings for the profiler.
         */
        readonly serverSettings: ServerConnection.ISettings;

        /**
         * Shut down the profiler.
         */
        shutdown(): Promise<void>;
    }

    /**
     * Start a new profiler.
     * 
     * @param options - The profiler options to use.
     * 
     * @returns A promise that resolves with the profiler instance.
     */
    export
    function startNew(s3path: string, options?: IOptions): Promise<IProfiler> {
        return DefaultProfiler.startNew(s3path, options);
    }

    /**
     * List the running profilers.
     * 
     * @param settings - The server settings to use.
     * 
     * @returns A promise that resolves with the list of running profiler models.
     */
    export
    function listRunning(settings?: ServerConnection.ISettings): Promise<IModel[]> {
        return DefaultProfiler.listRunning(settings);
    }

    /**
     * Shut down a profiler by name.
     * 
     * @param name - The name of the target profiler.
     * 
     * @param settings - The server settings to use.
     * 
     * @returns A promise that resolves when the profiler is shut down.
     */
    export
    function shutdown(name: string, settings?: ServerConnection.ISettings): Promise<void> {
        return DefaultProfiler.shutdown(name, settings);
    }

    /**
     * Shut down all profiler.
     * 
     * @returns A promise that resolves when all of the profilers are shut down.
     */
    export
    function shutdownAll(settings?: ServerConnection.ISettings): Promise<void> {
        return DefaultProfiler.shutdownAll(settings);
    }

    /**
     * Get profiler's url
     */
    export
    function getUrl(name: string, settings?: ServerConnection.ISettings): string {
        return DefaultProfiler.getUrl(name, settings);
    }

    /**
     * The options for intializing a profiler object.
     */
    export
    interface IOptions{
        /**
         * The server settings for the profiler.
         */
        serverSettings?: ServerConnection.ISettings;
    }

    /**
     * The server model for a profiler.
     */
    export
    interface IModel extends JSONObject {
        /**
         * The name of the run.
         */
        readonly name: string;
        /**
         * The s3 path of the profiler.
         */
        readonly s3path: string;
    }

     /**
     * The interface for a profiler manager.
     * 
     * The manager is respoonsible for maintaining the state of running
     * profiler.
     */
    export
    interface IManager extends IDisposable {

        readonly serverSettings: ServerConnection.ISettings;

        runningChanged: ISignal<this, IModel[]>;

        running(): IIterator<IModel>;

        startNew(s3path: string, options?: IOptions): Promise<IProfiler>;

        shutdown(name: string): Promise<void>;

        shutdownAll(): Promise<void>;

        refreshRunning(): Promise<void>;
    }

}

export
class DefaultProfiler implements Profiler.IProfiler {
    /**
     * Construct a new profiler.
     */
    constructor(name: string, s3path: string, options: Profiler.IOptions = {}) {
        this._name = name;
        this._s3path = s3path;
        this.serverSettings = options.serverSettings || ServerConnection.makeSettings();
        this._url = Private.getProfilerInstanceUrl(this.serverSettings.baseUrl, this._name);
    }

    /**
     * Get the name of the profiler.
     */
    get name(): string {
        return this._name;
    }

    /**
     * Get the model for the profiler.
     */
    get model(): Profiler.IModel {
        return { name: this._name, s3path: this._s3path };
    }

    /**
     * A signal emitted when the profiler is shut down.
     */
    get terminated(): Signal<this, void> {
        return this._terminated;
    }

    /**
     * Test whether the profiler is disposed.
     */
    get isDisposed(): boolean {
        return this._isDisposed;
    }

    /**
     * Dispose of the resources held by the profiler.
     */
    dispose(): void {
        if (this._isDisposed) {
            return;
        }

        this.terminated.emit(void 0);
        this._isDisposed = true;
        delete Private.running[this._url];
        Signal.clearData(this);
    }

    /**
     * The server settings for the profiler.
     */
    readonly serverSettings: ServerConnection.ISettings;

    /**
     * Shut down the profiler.
     */
    shutdown(): Promise<void> {
        const {name, serverSettings } = this;
        return DefaultProfiler.shutdown(name, serverSettings);
    }

    private _isDisposed = false;
    private _url: string;
    private _name: string;
    private _s3path: string;
    private _terminated = new Signal<this, void>(this);
}


/**
 * The static namespace for `DefaultProfiler`.
 */
export
namespace DefaultProfiler {
    /**
     * Start a new profiler.
     * 
     * @param options - The profiler options to use.
     * 
     * @returns A promise that resolves with the profiler instance.
     */
    export
    function startNew(s3path: string, options: Profiler.IOptions = {}): Promise<Profiler.IProfiler> {
        let serverSettings = options.serverSettings || ServerConnection.makeSettings();
        let url = Private.getServiceUrl(serverSettings.baseUrl);
        // ServerConnection won't automaticy add this header when the body in not none.
        let header = new Headers({ 'Content-Type': 'application/json' });
        
        let data = JSON.stringify({'s3path': s3path});

        let init = { method: 'POST' , headers: header, body: data };

        return ServerConnection.makeRequest(url, init, serverSettings).then(response => {
            if (response.status !== 200) {
                throw new ServerConnection.ResponseError(response);
            }
            return response.json();
        }).then((data: Profiler.IModel) => {
            let name = data.name;
            let s3path = data.s3path;
            return new DefaultProfiler(name, s3path, {...options, serverSettings });
        });
    }
    
    /**
     * List the running profilers.
     * 
     * @param settings - The server settings to use.
     * 
     * @returns A promise that resolves with the list of running profiler models.
     */
    export
    function listRunning(settings?: ServerConnection.ISettings): Promise<Profiler.IModel[]> {
        settings = settings || ServerConnection.makeSettings();
        let service_url = Private.getServiceUrl(settings.baseUrl);
        let instance_url = Private.getProfilerInstanceRootUrl(settings.baseUrl);
        return ServerConnection.makeRequest(service_url, {}, settings).then(response => {
            console.log("OLG3", response)
            if (response.status !== 200) {
                throw new ServerConnection.ResponseError(response);
            }
            return response.json();
        }).then((data: Profiler.IModel[]) => {
            console.log("OLG5", data )
            if (!Array.isArray(data)) {
                throw new Error('Invalid profiler data');
            }
            // Update the local data store.
            let urls = toArray(map(data, item => {
                return URLExt.join(instance_url, item.name);
            }));
            each(Object.keys(Private.running), runningUrl => {
                if (urls.indexOf(runningUrl) === -1) {
                    let profiler = Private.running[runningUrl];
                    profiler.dispose();
                }
            });
            return data;
        });
    }

    /**
     * Shut down a profiler by name.
     * 
     * @param name - Then name of the target profiler.
     * 
     * @param settings - The server settings to use.
     * 
     * @returns A promise that resolves when the profiler is shut down.
     */
    export
    function shutdown(name: string, settings?: ServerConnection.ISettings): Promise<void> {
        settings = settings || ServerConnection.makeSettings();
        let url = Private.getProfilerUrl(settings.baseUrl, name);
        let init = { method: 'DELETE' };
        return ServerConnection.makeRequest(url, init, settings).then(response => {
            if (response.status === 404) {
                return response.json().then(data => {
                    console.warn(data['message']);
                    Private.killProfiler(url);
                });
            }
            if (response.status !== 204) {
                throw new ServerConnection.ResponseError(response);
            }
            Private.killProfiler(url);
        });
    }

    /**
     * Shut down all profilers.
     * 
     * @param settings - The server settings to use.
     * 
     * @returns A promise that resolves when all the profilers are shut down.
     */
    export
    function shutdownAll(settings?: ServerConnection.ISettings): Promise<void> {
        settings = settings || ServerConnection.makeSettings();
        return listRunning(settings).then(running => {
            each(running, s => {
                shutdown(s.name, settings);
            });
        });
    }

    /**
     * According profiler's name to get profiler's url.
     */
    export
    function getUrl(name: string, settings?: ServerConnection.ISettings): string {
        settings = settings || ServerConnection.makeSettings();
        return Private.getProfilerInstanceUrl(settings.baseUrl, name);
    }
}


/**
 * A namespace for private data.
 */
namespace Private {
    /**
     * A mapping of running profilers by url.
     */
    export
    const running: { [key: string]: DefaultProfiler } = Object.create(null);

    /**
     * Get the url for a profiler.  
     */
    export
    function getProfilerUrl(baseUrl: string, name: string): string {
        return URLExt.join(baseUrl, PROFILER_SERVICE_URL, name);
    }

    /**
     * Get the base url.
     */
    export
    function getServiceUrl(baseUrl: string): string {
        return URLExt.join(baseUrl, PROFILER_SERVICE_URL);
    }

    /**
     * Kill profiler by url.
     */
    export
    function killProfiler(url: string): void {
        // Update the local data store.
        if (Private.running[url]) {
            let profiler = Private.running[url];
            profiler.dispose();
        }
    }

    export
    function getProfilerInstanceRootUrl(baseUrl: string): string {
        return URLExt.join(baseUrl, PROFILER_URL);
    }

    export
    function getProfilerInstanceUrl(baseUrl: string, name: string): string {
        return URLExt.join(baseUrl, PROFILER_URL, name);
    }
}