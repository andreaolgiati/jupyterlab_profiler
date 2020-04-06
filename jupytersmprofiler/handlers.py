import json
import os
import tornado

from notebook.base.handlers import APIHandler
from tornado.web import StaticFileHandler, HTTPError



# handles the API part of managing
class ProfilerRootHandler(APIHandler):
  # list all instances
  @tornado.web.authenticated
  def get(self):
    pm = self.settings['profiler_manager']
    data = []
    insts = pm.list_profilers()
    for (name,s3path) in insts:
        data.append( { 's3path': s3path, 'name': name} )
    self.finish(json.dumps(data))

  # create a new instance
  @tornado.web.authenticated
  def post(self):
    #input_data = self.get_json_body()
    pm = self.settings['profiler_manager']
    (name, s3path) = pm.new_profiler()
    res = { 'name': name, 's3path' : s3path }
    self.finish(json.dumps(res))



class ProfilerInstanceHandler(APIHandler):

  SUPPORTED_METHODS = ('GET', 'DELETE')

  # describe
  @tornado.web.authenticated
  def get(self, name):
    pm = self.settings['profiler_manager']
    profiler_handler = pm.get_profiler(name)
    name, s3path = profiler_handler.describe()
    res = { name: name, s3path : s3path }
    self.finish(json.dumps(res))

  @tornado.web.authenticated
  def delete(self, name):
    print( f'CallingDelete {name}')
    pm = self.settings['profiler_manager']
    if pm.terminate(name):
      self.set_status(204)
      self.finish()
    else:
      raise HTTPError(404, f'Profiler {name} not found')


