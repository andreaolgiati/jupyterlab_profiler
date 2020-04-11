import altair as alt
import boto3
import json
import numpy as np
import os
import pandas as pd
import random
import tornado
import tornado.ioloop
import tornado.web

from io import BytesIO
from tornado.web import RequestHandler, HTTPError


class ProfilerDataHandler(RequestHandler):
  def prepare(self):
    self.set_header('Content-Type', 'application/json')
    self.s3res = boto3.resource('s3')

  #@tornado.web.authenticated
  def get(self):
    bucket_name = self.get_argument('bucket', None)
    if bucket_name is None:
       raise HTTPError(reason='No bucket specified', status_code=400)

    object_name = self.get_argument('object', None)
    if object_name is None:
       raise HTTPError(reason='No prefix specified', status_code=400)

    bucket = self.s3res.Bucket(bucket_name)
    if bucket is None:
       raise HTTPError(reason=f'Bucket {bucket_name} does not exist', status_code=404)

    obj = bucket.Object(object_name)
    if obj is None:
       raise HTTPError(reason=f'Object {object_name} does not exist in bucket {bucket_name}', status_code=404)

    json_data = BytesIO()
    obj.download_fileobj(json_data)

    # JSON should look like so:
    # [
    #   {"date": 0, "value": 0.179, "type": "cpu_0"}, 
    #   {"date": 1, "value": 0.157, "type": "cpu_0"}, 
    #   ...
    #   {"date": 200, "value": 0.221, "type": "cpu_0"}, 
    #   ...
    #   {"date": 1, "value": 0.204, "type": "gpu_4"}, 
    #   ...
    #   {"date": 1, "value": 0.20, "type": "network"}, 
    #   {"date": 23, "value": 0.1, "type": "network"}, 
    # ]
    # - "type" is a free variable, Vega will distinguish. You can add new types
    # - the list does not need to be ordered: you can randomly shuffle this list and the viz will be identical

    self.write(json_data.getvalue())


def make_app():
  settings = {
    "static_path": os.getcwd(),
    "static_url_prefix": "/resources/",
  }
  return tornado.web.Application( [
    (r'/profiler/data', ProfilerDataHandler),
  ], 
  debug=True,
  **settings )

if __name__ == "__main__":
    app = make_app()
    app.listen(8887)
    tornado.ioloop.IOLoop.current().start()
