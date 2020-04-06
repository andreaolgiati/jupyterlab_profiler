//import {
//    Time
//} from '@jupyterlab/coreutils';

import {
  Message
} from '@phosphor/messaging';

import {
  Widget
} from '@phosphor/widgets';

import {
    ElementExt
} from '@phosphor/domutils';

import {
  DOMUtils, Dialog, showDialog
} from '@jupyterlab/apputils';

import { 
  Profiler 
} from './profiler';

import { 
  Signal, ISignal 
} from '@phosphor/signaling';


/**
 * The class name added to a profiler widget.
 */
const PROFILERS_CLASS = 'jp-Profilers';

const HEADER_CLASS = 'jp-Profilers-header';

const REFRESH_CLASS = 'jp-Profilers-headerRefresh';

const PROFILER_CLASS = 'jp-Profilers-profilerSection';

const SHUTDOWN_PROFILER_CLASS = 'jp-Profilers-ShutdownAll';

const SECTION_HEADER_CLASS = 'jp-Profilers-sectionHeader';

const CONTAINER_CLASS = 'jp-Profilers-sectionContainer';

const LIST_CLASS = 'jp-Profilers-sectionList';

const PROFILER_ITEM_CLASS = 'jp-Profilers-item';

const PROFILER_ICON_CLASS = 'jp-Profilers-itemIcon';

const PROFILER_LABEL_CLASS = 'jp-Profilers-itemLabel';

const SHUTDOWN_BUTTON_CLASS = 'jp-Profilers-itemShutdown';

/**
 * A class that exposes the running profilers.
 */
export
class RunningProfilers extends Widget {
    /**
     * Construct a new running widget.
     */
    constructor(options: RunningProfilers.IOptions) {
        super({
            node: (options.renderer || RunningProfilers.defaultRenderer).createNode()
        });
        let manager = this._manager = options.manager;
        this._renderer = options.renderer || RunningProfilers.defaultRenderer;
        this.addClass(PROFILERS_CLASS);

        // Populate the profiler section.
        let profilerNode = DOMUtils.findElement(this.node, PROFILER_CLASS);
        let profilerHeader = this._renderer.createProfilerHeaderNode();
        profilerHeader.className = SECTION_HEADER_CLASS;
        profilerNode.appendChild(profilerHeader);
        let profilerContainer = document.createElement('div');
        profilerContainer.className = CONTAINER_CLASS;
        let profilerList = document.createElement('ul');
        profilerList.className = LIST_CLASS;
        profilerContainer.appendChild(profilerList);
        profilerNode.appendChild(profilerContainer);
        
        manager.runningChanged.connect(this._onProfilersChanged, this);
    }

    /**
     * The renderer used by the profiler widget.
     */
    get renderer(): RunningProfilers.IRenderer {
        return this._renderer;
    }

    get profilerOpenRequested(): ISignal<this, Profiler.IModel> {
        return this._profilerOpenRequested;
    }

    get profilerShutdownRequested(): ISignal<this, Profiler.IModel> {
        return this._profilerShutdownRequested;
    }

    /**
     * Refresh the widget.
     */
    refresh(): Promise<void> {
        clearTimeout(this._refreshId);
        let promise: Promise<void>[] = [];
        promise.push(this._manager.refreshRunning());
        return Promise.all(promise).then(() => void 0);
    }

    /**
     * Handle the DOM events for the widget.
     * 
     * @param event - The DOM event sent to the widget.
     */
    handleEvent(event: Event): void {
        if (event.type === 'click') {
            this._evtClick(event as MouseEvent);
        }
    }

    /**
     * A message handler invoked on an `'after-attach'` message.
     */
    protected onAfterAttach(msg: Message): void {
        this.node.addEventListener('click', this);
    }

    /**
     * A message handler invoked on a `'before-detach'` message.
     */
    protected onBeforeDetach(msg: Message): void {
        this.node.removeEventListener('click', this);
    }

    /**
     * A message handler invoked on an `'update-request'` message.
     */
    protected onUpdateRequest(msg: Message): void {
        let tbSection = DOMUtils.findElement(this.node, PROFILER_CLASS);
        let tbList = DOMUtils.findElement(tbSection, LIST_CLASS);
        let renderer = this._renderer;

        // Remove any excess item nodes.
        while (tbList.children.length > this._runningProfilers.length) {
            tbList.removeChild(tbList.firstChild!);
        }

        // Add any missing item nodes.
        while (tbList.children.length < this._runningProfilers.length) {
            let node = renderer.createProfilerNode();
            node.classList.add(PROFILER_ITEM_CLASS);
            tbList.appendChild(node);
        }

        // Populate the nodes.
        for (let i = 0; i < this._runningProfilers.length; i++) {
            let node = tbList.children[i] as HTMLLIElement;
            renderer.updateProfilerNode(node, this._runningProfilers[i]);
        }
    }

    /**
     * Handle the `'click'` event for the widget.
     * 
     * #### Notes
     * This listener is attached to the document node.
     */
    private _evtClick(event: MouseEvent): void {
        let tbSection = DOMUtils.findElement(this.node, PROFILER_CLASS);
        let tbList = DOMUtils.findElement(tbSection, LIST_CLASS);
        let refresh = DOMUtils.findElement(this.node, REFRESH_CLASS);
        let shutdownTB = DOMUtils.findElement(this.node, SHUTDOWN_PROFILER_CLASS);
        let renderer = this._renderer;
        let clientX = event.clientX;
        let clientY = event.clientY;

        // Check for a refresh
        if (ElementExt.hitTest(refresh, clientX, clientY)) {
            this.refresh();
            return;
        }

        // Check for profiler shutdown.
        if (ElementExt.hitTest(shutdownTB, clientX, clientY)) {
            showDialog({
                title: 'Shutdown All Profilers?',
                body: 'Shut down all profilers?',
                buttons: [
                    Dialog.cancelButton(), Dialog.warnButton({ label: 'SHUTDOWN' })
                ]
            }).then(result => {
                if (result.button.accept) {
                    this._manager.shutdownAll();
                }
            });
        }

        // Check for a profiler item click.
        let index = DOMUtils.hitTestNodes(tbList.children, clientX, clientY);
        if (index !== -1) {
            let node = tbList.children[index] as HTMLLIElement;
            let shutdown = renderer.getProfilerShutdown(node);
            let model = this._runningProfilers[index];
            if (ElementExt.hitTest(shutdown, clientX, clientY)) {
                this._manager.shutdown(model.name);
                return;
            }
            this._profilerOpenRequested.emit(model);
        }
    }

    /**
     * Handle a change to the running profilers.
     */
    private _onProfilersChanged(sender: Profiler.IManager, models: Profiler.IModel[]): void {
        for (let tb of this._runningProfilers) {
            if (models.findIndex(value => value.name === tb.name ) === -1) {
                this._profilerShutdownRequested.emit(tb);
            }
        }
        this._runningProfilers = models;
        this.update();
    }

    private _manager: Profiler.IManager;
    private _renderer: RunningProfilers.IRenderer;
    private _runningProfilers: Profiler.IModel[] = [];
    private _refreshId = -1;
    private _profilerOpenRequested = new Signal<this, Profiler.IModel>(this);
    private _profilerShutdownRequested = new Signal<this, Profiler.IModel>(this);
}

/**
 * The namespace for the `RunningProfilers` class statics.
 */
export
namespace RunningProfilers {
    /**
     * An options object for creating a running profilers widget.
     */
    export
    interface IOptions {
        /**
         * A profiler manager instance.
         */
        manager: Profiler.IManager;

        /**
         * The renderer for the running profilers widget.
         */
        renderer?: IRenderer;
    }
    
    /**
     * A renderer for use with a running profiler widget.
     */
    export
    interface IRenderer {
        /**
         * Create the root node for the running profilers widget.
         */
        createNode(): HTMLElement;

        /**
         * Create a node for a running profiler item.
         * 
         * @returns A new node for a running profiler item.
         */
        createProfilerNode(): HTMLLIElement;

        /**
         * Create a fully populated header node for the profilers section.
         * 
         * @returns A new node for a running profiler header.
         */
        createProfilerHeaderNode(): HTMLElement;

        /**
         * Get the shutdown node for a profiler node.
         * 
         * @param node - A node created by a call to `createProfilerNode`.
         * 
         * @returns The node representing the shutdown option.
         */
        getProfilerShutdown(node: HTMLLIElement): HTMLElement;

        /**
         * Populate a node with running profiler data.
         * 
         * @param node - A node created by a call to `createProfilerNode`.
         * 
         * @param model - The models of profiler.
         * 
         * #### Notes
         * This method should completely reset the state of the node to
         * reflect the data for the profiler models.
         */
        updateProfilerNode(node: HTMLLIElement, model: Profiler.IModel): void;
    }

    /**
     * The default implementation of `IRenderer`.
     */
    export
    class Renderer implements IRenderer {
        /**
         * Create the root node for the running profiler widget.
         */
        createNode(): HTMLElement {
            let node = document.createElement('div');
            let header = document.createElement('div');
            header.className = HEADER_CLASS;
            let profilers = document.createElement('div');
            profilers.className = `${PROFILER_CLASS}`;

            let refreash = document.createElement('button');
            refreash.title = 'Refresh Profilers List';
            refreash.className = REFRESH_CLASS;
            header.appendChild(refreash);

            node.appendChild(header);
            node.appendChild(profilers);
            return node;
        }

        createProfilerHeaderNode(): HTMLElement {
            let node = document.createElement('div');
            node.textContent = 'Profilers';

            let shutdown = document.createElement('button');
            shutdown.title = 'Shutdown All Profilers';
            shutdown.className = SHUTDOWN_PROFILER_CLASS;
            node.appendChild(shutdown);

            return node;
        }

        createProfilerNode(): HTMLLIElement {
            let node = document.createElement('li');
            let icon = document.createElement('span');
            icon.className = PROFILER_ICON_CLASS;
            let label = document.createElement('span');
            label.className = PROFILER_LABEL_CLASS;
            let shutdown = document.createElement('button');
            shutdown.className = `${SHUTDOWN_BUTTON_CLASS} jp-mod-styled`;
            shutdown.textContent = 'SHUTDOWN';

            node.appendChild(icon);
            node.appendChild(label);
            node.appendChild(shutdown);
            return node;
        }

        getProfilerShutdown(node: HTMLElement): HTMLElement {
            return DOMUtils.findElement(node, SHUTDOWN_BUTTON_CLASS);
        }

        updateProfilerNode(node: HTMLLIElement, model: Profiler.IModel): void {
            let label = DOMUtils.findElement(node, PROFILER_LABEL_CLASS);
            label.textContent = `profiler/${model.name}`;
            let title = (
                `S3 Path: ${model.s3path}\n`
            );
            label.title = title;
        }
    }

    /**
     * The default `Renderer` instance.
     */
    export
    const defaultRenderer = new Renderer();
}