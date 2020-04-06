import {
  IFrame
} from '@jupyterlab/apputils';

import {
  Message
} from '@phosphor/messaging';

import {
  Profiler
} from './profiler';

import { 
  Widget 
} from '@phosphor/widgets';

//import {
//  HTMLViewer
//} from '@jupyterlab/htmlviewer';

const PROFILER_CLASS = 'jp-Profiler';

const PROFILER_ICON_CLASS = 'jp-Profilers-itemIcon';

/**
 * A widget which manages a profiler.
 */
export
class ProfilerTab extends IFrame {
  /**
   * Construct a new profiler widget.
   */
  constructor(options?: ProfilerTab.IOptions) {
    super({sandbox: ['allow-scripts', 'allow-forms', 'allow-same-origin']});
    this.addClass(PROFILER_CLASS);
    this.profiler = this._profiler = options.model;
    this.url = Profiler.getUrl(this._profiler.name);

    // Initialize settings.
    this.id = `jp-Profiler-${Private.id++}`;
    this.title.label = `Profiler ${this._profiler.name}`;
    this.title.icon = PROFILER_ICON_CLASS;
    this.title.closable = true;
    let caption = `Name: Profiler ${this._profiler.name} S3Path: ${this._profiler.s3path}`;
    this.title.caption = caption;
  };

  readonly profiler: Profiler.IModel;

  /**
   * Dispose of the resources held by the profiler widget.
   */
  dispose(): void {
    this._profiler = null;
    super.dispose();
  };

  protected onCloseRequest(msg: Message): void {
    super.onCloseRequest(msg);
    this.dispose();
  };

  private _profiler: Profiler.IModel;
}

export declare namespace ProfilerTab {

  /**
   * Options of the profiler widget.
   */
  interface IOptions {
    /**
     * The model of profiler instance.
     */
    readonly model: Profiler.IModel;
  }
}

/**
 * Widget for inputing profiler s3 path
 */
export
class OpenS3PathWidget extends Widget {
  constructor() {
    super({node: Private.createOpenNode() });
  }

  /**
   * Get the value of the widget
   */
  getValue(): string {
    return this.inputNode.value;
  }

  /**
   * Get the input text node.
   */
  get inputNode(): HTMLInputElement {
    return this.node.getElementsByTagName('input')[0] as HTMLInputElement;
  }

}

namespace Private {

  export
  function createOpenNode(): HTMLElement {
    let body = document.createElement('div');
    let existingLabel = document.createElement('label');
    existingLabel.textContent = 'S3 Path:';

    let input = document.createElement('input');
    input.value = '';
    input.placeholder = 's3://path/to/data';

    body.appendChild(existingLabel);
    body.appendChild(input);
    return body;
  }

  export
  let id = 0;
}