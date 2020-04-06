import {
  ILayoutRestorer, JupyterFrontEnd, JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ICommandPalette, WidgetTracker, IWidgetTracker, showDialog, Dialog, MainAreaWidget
} from '@jupyterlab/apputils';

import {
  ILauncher
} from '@jupyterlab/launcher';

import {
  IMainMenu
} from '@jupyterlab/mainmenu';

import {
  IFileBrowserFactory
} from '@jupyterlab/filebrowser';

import { 
  RunningProfilers
} from './panel';

import {
  ProfilerManager
} from './manager';

import {
  Profiler 
} from './profiler';

import {
  ProfilerTab, OpenS3PathWidget
} from './tab';

import '../style/index.css';

const PROFILER_ICON_CLASS = 'jp-Profiler-icon';

/**
 * The command IDs used by the profiler plugin.
 */
namespace CommandIDs {
  export
  const createNew = 'profiler:create-new';

  export
  const inputDirect = 'profiler:choose-direct';

  export
  const open = 'profiler:open';

  export
  const close = 'profiler:close';
}

/**
 * Initialization data for the profiler extension.
 */
const extension: JupyterFrontEndPlugin<IWidgetTracker<MainAreaWidget<ProfilerTab>>> = {
  id: 'profiler',
  requires: [ILayoutRestorer, ICommandPalette, IFileBrowserFactory],
  optional: [ILauncher, IMainMenu],
  autoStart: true,
  activate,
};

export default extension;

function activate(app: JupyterFrontEnd, restorer: ILayoutRestorer, palette: ICommandPalette, browserFactory: IFileBrowserFactory, launcher: ILauncher | null, menu: IMainMenu | null): WidgetTracker<MainAreaWidget<ProfilerTab>> {
  let manager = new ProfilerManager();
  let running = new RunningProfilers({manager: manager});
  running.id = 'jp-Profilers';
  running.title.label = 'Profilers';
  
  const namespace = 'profiler';
  const tracker = new WidgetTracker<MainAreaWidget<ProfilerTab>>({ namespace })

  // Let the application restorer track the running panel for restoration of
  // application state (e.g. setting the running panel as the current side bar
  // widget).
  restorer.add(running, 'Profilers');

  addCommands(app, manager, tracker, browserFactory, launcher, menu);

  running.profilerOpenRequested.connect((sender, model) => {
    app.commands.execute('profiler:open', { tb: model });
  });

  running.profilerShutdownRequested.connect((sender, model) => {
    app.commands.execute('profiler:close', { tb: model });
  })

  palette.addItem({ command: CommandIDs.inputDirect , category: 'Profiler' });

  app.shell.add(running, "left",{rank: 300});
  return tracker
}

/**
 * Add the commands for the profiler.
 */
export
function addCommands(app: JupyterFrontEnd, manager: ProfilerManager, 
                     tracker: WidgetTracker<MainAreaWidget<ProfilerTab>>, 
                     browserFactory: IFileBrowserFactory, 
                     launcher: ILauncher | null, menu: IMainMenu | null) {
  let { commands, serviceManager } = app;

  commands.addCommand(CommandIDs.open, {
    execute: args => {
      const model = args['tb'] as Profiler.IModel;
      
      console.log(model)
      // Check for a running profiler with the given model.
      const widget = tracker.find(value => {
        return value.content.profiler && value.content.profiler.name === model.name || false;
      });
      if (widget) {
        app.shell.activateById(widget.id);
        return widget;
      } else {
        let t = new ProfilerTab({model});
        let tb = new MainAreaWidget({ content: t });
        tracker.add(tb);
        app.shell.add(tb, "main");
        app.shell.activateById(tb.id);
        return tb;
      }
    }
  });

  commands.addCommand(CommandIDs.close, {
    execute: args => {
      const model = args['tb'] as Profiler.IModel;

      const widget = tracker.find(value => {
        return value.content.profiler && value.content.profiler.name === model.name || false;
      });
      if (widget) {
        widget.dispose();
        widget.close();
      }
    }
  });

  commands.addCommand(CommandIDs.inputDirect, {
    label: () => 'Create a new profiler',
    execute: args => {
      showDialog({
        title: 'Input the S3 Path to create a new Profiler',
        body: new OpenS3PathWidget(),
        buttons: [Dialog.cancelButton(), Dialog.okButton({ label : 'CREATE'})],
        focusNodeSelector: 'inpute'
      }).then(result => {
        if (result.button.label === 'CREATE') {
          const s3path = <string>result.value;
          return app.commands.execute(CommandIDs.createNew, {s3path: s3path});
        } else {
          return;
        }
      });
    }
  });

  commands.addCommand(CommandIDs.createNew, {
    label: args => (args['isPalette'] ? 'New Profiler' : 'Profiler'),
    caption: 'Start a brand new profiler',
    iconClass: args => (args['isPalette'] ? '' : PROFILER_ICON_CLASS),
    execute: args => {
      let cwd = args['cwd'] as string || browserFactory.defaultBrowser.model.path;
      const s3path = typeof args['s3path'] === 'undefined' ? cwd : args['s3path'] as string;
      return serviceManager.contents.get(s3path, { type: 'directory'}).then(dir => {
          return manager.startNew(dir.path).then(tb => {
            return app.commands.execute(CommandIDs.open, { tb: tb.model});
          });
        }, () => {
          // no such directory.
          return showDialog({
            title: 'Cannot create profiler.',
            body: 'Directory not found',
            buttons: [Dialog.okButton()]
          });
        });
    },
  });

  if (launcher) {
      launcher.add({
          command: CommandIDs.createNew,
          category: 'Other',
          rank: 2,
      });
  }

  if (menu) {
    menu.fileMenu.newMenu.addGroup([{
      command: CommandIDs.createNew
    }], 30);
  }
}
