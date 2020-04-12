import altair as alt
import boto3
import json
import numpy as np
import os
import pandas as pd
import random
import sys
import tornado
import tornado.ioloop
import tornado.web

from io import BytesIO
from tornado.web import RequestHandler, HTTPError

class DummyDataHandler(RequestHandler):

  def initialize(self, s3res):
    self.set_header('Content-Type', 'application/json')
    self.s3res = s3res
  
  def get(self):
    x = int(self.get_argument('x'))
    res = [
       {"date": x, "value": np.random.uniform(low=0,high=1), "type": 0 }, 
       {"date": x, "value": np.random.uniform(low=0,high=1), "type": 1 }, 
    ]
    print( "CALL=", x)
    self.finish(json.dumps(res))

class ProfilerDataHandler(RequestHandler):

  def initialize(self, s3res):
    self.set_header('Content-Type', 'application/json')
    self.s3res = s3res
 
  #@tornado.web.authenticated
  def get(self):
    bucket_name = self.get_argument('bucket')
    object_name = self.get_argument('object')
    min_date = float(self.get_argument('min_date', sys.float_info.min))
    max_date = float(self.get_argument('max_date', sys.float_info.max))
    print( self.request.full_url)
    
    bucket = self.s3res.Bucket(bucket_name)
    obj = bucket.Object(object_name)

    json_data = BytesIO()
    obj.download_fileobj(json_data)

    full_data = json.loads(json_data.getvalue())
    #print("FD=", full_data[0])


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

    filtered = []
    for x in full_data:
      #print("X=", x )
      d = float(x['date'])
      if d < min_date or d > max_date:
        continue
      filtered.append(x)
    self.write(json.dumps(filtered))


def make_app():
  settings = {
    "static_path": os.getcwd(),
    "static_url_prefix": "/resources/",
  }

  s3res = boto3.resource('s3')

  return tornado.web.Application( [
    (r'/profiler/data', ProfilerDataHandler, dict(s3res = s3res)),
    (r'/dummy', DummyDataHandler, dict(s3res = s3res)),
  ], 
  debug=True,
  **settings )

if __name__ == "__main__":
    app = make_app()
    app.listen(8887)
    tornado.ioloop.IOLoop.current().start()
