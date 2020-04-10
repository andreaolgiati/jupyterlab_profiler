from notebook.utils import url_path_join

from .handlers import ProfilerRootHandler, ProfilerInstanceHandler
from .profiler_handlers import ProfilerApplicationManager
from .template_handlers import ProfilerTemplateHandler, ProfilerDataHandler
from ._version import __version__


def _jupyter_server_extension_paths():
    return [{
        'module': 'jupytersmprofiler'
    }]

def load_jupyter_server_extension(nb_app):
    """Registers the API handler to receive HTTP requests from the frontend extension.
    Parameters
    ----------
    nb_app: notebook.notebookapp.NotebookApp
        Notebook application instance
    """
    url_path = 'jupytersmprofiler'
    setup_handlers(nb_app.web_app, url_path)
    nb_app.log.info('Registered jupytersmprofiler extension at URL path /{}'.format(url_path))


def setup_handlers(web_app, url_path):
    host_pattern = '.*$'
    base_url = web_app.settings['base_url']
    root_pattern = url_path_join(base_url, url_path)
    

    # CP operations
    ## root
    handlers = [(url_path_join(root_pattern,'/api/profiler'), ProfilerRootHandler)]
    ## instance
    handlers += [(url_path_join(root_pattern, r'/api/profiler/(\w+)'), ProfilerInstanceHandler)]

    # DP operations
    ## Vega template and data
    handlers += [(url_path_join(root_pattern, r'/profiler/template/(\w+)'), ProfilerTemplateHandler)]
    handlers += [(url_path_join(root_pattern, r'/profiler/data/(\w+)'), ProfilerDataHandler)]
    web_app.add_handlers(host_pattern, handlers)

    web_app.settings['profiler_manager'] = ProfilerApplicationManager()
