import uuid

# handles the state of one profiler
class ProfilerApplication():
  def __init__(self, name, s3path):
    self.name = name
    self.s3path = s3path
  
  def describe(self):
    return (self.name, self.s3path)


class ProfilerApplicationManager():
  # keeps a master list of all profiler sessions
  def __init__(self):
    self._instances = {}

  def list_profilers(self):
    res = []
    for inst in self._instances:
      (name,s3path) = self._instances[inst].describe()
      res.append((name,s3path))
    return res

  def new_profiler(self):
    # this is where we'd put stateful work
    name = uuid.uuid4().hex
    s3path = f's3://{name}/'
    self._instances[name] = ProfilerApplication(name,s3path)
    return (name, s3path)

  def get_profiler(self, name):
    return self._instances[name]

  # returns True if there was something to delete
  def terminate(self, name):
    inst = self._instances.pop(name, None)
    print( f'TERMINATE name={name}, instance={inst}' )
    if inst is not None:
        del inst
        return True
    return False
