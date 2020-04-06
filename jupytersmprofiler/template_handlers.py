import altair as alt
import json
import numpy as np
import os
import pandas as pd
import random
import tornado

from io import StringIO
#from notebook.base.handlers import APIHandler
from tornado.web import StaticFileHandler, HTTPError, RequestHandler

class ProfilerTemplateHandler(RequestHandler):
  # describe
  #@tornado.web.authenticated
  def get(self, name):
    # TODO: obtain actual data from S3
    vals = generate_data( 0, 10, 10 )
    df = pd.DataFrame(vals)
    chart = alt.Chart(df).mark_line().encode( x='date:T', y='value:Q', color='type:N' )
    sio = StringIO()
    chart.save(sio, format='html')
    self.set_header('Content-Type', 'text/html')
    self.write(sio.getvalue())
    #self.finish(json.dumps(res))


#def rands(x):
#    y = 0
#    result = []
#    for _ in x:
#        result.append(y)
#        y += np.random.normal(scale=1)
#    return np.array(result)

def generate_data(time_start, time_end, item_no):
  names = ['cpu_0', 'cpu_1', 'cpu_2', 'cpu_3',
           'gpu_0', 'gpu_1', 'gpu_2', 'gpu_3','gpu_4', 'gpu_5', 'gpu_6', 'gpu_7',
           'network', 'disk']
  res = []
  for _ in range(item_no):
    tm = random.uniform(time_start, time_end)
    nm = random.choice(names)
    val = random.uniform(0, 1)
    res.append({ 'date': tm, 'type' : nm, 'value': val })
  return res
