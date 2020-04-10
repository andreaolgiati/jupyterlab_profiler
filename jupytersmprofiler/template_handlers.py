import altair as alt
import json
import numpy as np
import os
import pandas as pd
import random
import tornado
import tornado.ioloop
import tornado.web

from io import StringIO
from tornado.web import RequestHandler

class ProfilerTemplateHandler(RequestHandler):
  # describe
  #@tornado.web.authenticated
  def get(self, name):
    # TODO: obtain actual data from S3
    res = []
    for nm in [ 'cpu_0', 'cpu_1', 'gpu_0', 'gpu_1', 'network', 'disk']:
      res.extend(signalseq( 5, 4, nm ))
    df = pd.DataFrame(res)
    chart = alt.Chart(df).mark_line().encode( x='date:T', y='value:Q', color='type:N' ).properties(
      width=1200,
      height=300
    )
    sio = StringIO()
    chart.save(sio, format='html')
    #self.set_header('Content-Type', 'text/html')
    self.write(sio.getvalue())
    #self.finish(json.dumps(res))


class ProfilerDataHandler(RequestHandler):
  def prepare(self):
    self.set_header('Content-Type', 'application/json')
  
  #describe
  #@tornado.web.authenticated
  def get(self, name=None):
    # TODO: obtain actual data from S3
    res = []
    for nm in [ 'cpu_0', 'cpu_1', 'gpu_0', 'gpu_1', 'network', 'disk']:
      res.extend(signalseq( 500, 20, nm ))
    self.finish(json.dumps(res))

def signalseq( sz, smoothfactor, nm):
    ts = np.arange(sz) #.astype(float)
    #ts += np.random.uniform(low=0, high=1, size=(sz))
    rms = np.convolve(np.random.randn(sz), np.ones((smoothfactor,))/smoothfactor)[(smoothfactor-1):]
    rms += -min(rms)
    rms /= max(rms)
    #plt.plot( ts, rms )
    res = []
    for t, rm in zip(ts,rms):
      res.append({ 'date': int(t), 'value' : float(rm), 'type': str(nm)})
    return res



def make_app():
    return tornado.web.Application([
        (r"/", ProfilerDataHandler),
    ], debug=True)

if __name__ == "__main__":
    app = make_app()
    app.listen(8887)
    tornado.ioloop.IOLoop.current().start()
