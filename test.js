var Lapiz = Lapiz || Object.create(null);

// SetupTestModule is a wrapper so that if Lapiz is used, it will be loaded
// as a module and if it is not used, it will create a dummy Lapiz.
(function SetupTestModule(){
  function TestingModule($L){

    // We're using Object.create(null) as a map, this makes it a little cleaner
    // to read
    function _Map(){
      return Object.create(null);
    }

    var RanStates = {
      "NotRan" : {
        "Str": "NotRan",
        "Int": 0
      },
      "Ran" : {
        "Str": "Ran",
        "Int": 1
      },
      "Waiting" : {
        "Str": "Waiting",
        "Int": 2
      },
      "Skip" : {
        "Str": "Skip",
        "Int": 3
      },
    };
    RanStates[0] = RanStates.NotRan;
    RanStates[1] = RanStates.Ran;
    RanStates[2] = RanStates.Waiting;
    RanStates[3] = RanStates.Skip;
    Object.freeze(RanStates);
    
    // testnameMap maps the name of the test or group to the instance. This makes is
    // easier to retreive by name than splitting the name by / are recursing
    // through the heirarchy
    var nameMap = _Map();

    // test is a list of all the test, it does not include groups
    var tests = [];

    // _Group is not exposed, it is just used internally to handle dependencies
    function _Group(name, parent){
      var self = _Map();

      self.name = name;
      self.circularCheck = false;
      self.fullName = function(){
        return self.parent.fullName() + self.name + "/";
      }

      self.parent = parent;
      self.children = _Map();

      self.GetChild = function(name){
        var child = self.children[name];
        if (child === undefined){
          child = _Group(name, self);
          self.children[name] = child;
          nameMap[child.fullName()] = child;
        }
        return child;
      };

      self.failed = function(){ return !self.passed(); };
      self._passed = true;
      self.passed = function(){
        return self._passed;
      };

      self._ran = RanStates.NotRan.Int;
      self.ran = function(){
        return self._ran;
      }

      self.dependents = [];
      self.finish = function(){
        if (self._ran !== RanStates.Skip.Int){
          self._ran = RanStates.Ran.Int;
        }
        var ln = self.dependents.length;
        var i;
        for (i=0;i<ln;i++){
          self.dependents[i](self);
        }
      }

      var waitingOn = 0;
      self.addDependency = function(dependency){
        dependency.dependents.push(self.dependencyCallback);
        waitingOn++;
      };

      self.dependencyCallback = function(dependency){
        if (dependency.failed()){
          self._passed = false;
        }

        if (dependency.ran() === RanStates.Skip.Int){
          self._ran = RanStates.Skip.Int;
        }
        
        waitingOn--;
        if (waitingOn === 0){
          self.finish()
        }
      }

      return self;
    }

    var _root = _Group("", null);
    _root.fullName = function(){ return ""; };

    /**
     * _log is used in _Test.log and _Test.error
     */
    function _log(test, args){
      if (args.length === 0) {
        return test.log.slice(0);
      }
      var strArgs = [];
      for (var i=0; i<args.length; i++){
        strArgs.push(_string(args[i]));
      }
      test.log.push(strArgs.join(""));
    }

    /**
     * @constructor _Test
     */
    function _Test(name, dependencies, testFunc){
      var self = _Map();
      // private properties
      self.name = name;
      self.nameList = name.split("/");
      self.dependencyNames = dependencies;
      self.func = testFunc;
      self._ran = RanStates.NotRan.Int;
      self._failed = false;
      self.scheduled = false;
      self.circularCheck = false;
      self.parent = parent;
      self.log = [];

      self.fullName = function(){
        var name = self.parent.fullName();
        return name.substring(0, name.length - 1);
      };
      self.ran = function(){return self._ran;};

      self.pub = _Map();
      //public methods

      // > TestObject.log()
      // > TestObject.log(args...)
      // If no arguments are given, the log is returned as a slice of strings.
      // If an arguments are given, they will be concatenated into a string and
      // appended to the log.
      self.pub.log = function(){
        return _log(self, arguments);
      };

      // > TestObject.fail()
      // Causes the test to fail.
      self.pub.fail = function(){
        self.failed = true;
      };

      // > TestObject.error(args...)
      // Causes the test to fail and logs the arguments.
      self.pub.error = function(){
        self._failed = true;
        _log(self, arguments);
      };

      // > TestObject.failed()
      // Returns a bool indicating if the test has failed.
      self.pub.failed = function(){ return self._failed; };
      self.failed = self.pub.failed;

      var waitingOn = 0;
      self.addDependency = function(dependency){
        dependency.dependents.push(self.dependencyCallback);
        waitingOn++;
      };

      self.dependencyCallback = function(dependency){
        if (dependency.failed() || dependency.ran() === RanStates.Skip.Int){
          self._ran = RanStates.Skip.Int;
        }

        waitingOn--;
        if (waitingOn === 0){
          if (self._ran != RanStates.Skip.Int){
            self.run();
          } else {
            self.pub.finish(); 
          }
        }
      }

      self.run = function(){
        if (self._ran != RanStates.Skip.Int){
          self.start = Date.now();
          try {
            self.func(self.pub);
          } catch(err) {
            if (err.message){
              console.error(err);
              console.log(err.stack);
              self.pub.error(err.message + "<pre>" + err.stack + "</pre>");
            } else {
              console.error(err.stack);
              self.pub.error("<pre>" + err.stack + "</pre>");
            }
          }
        }

        if (self._ran !== RanStates.Waiting.Int){
          self.pub.finish();
        }
      }

      // > TestObject.async(milliseconds, message)
      var timeout;
      self.pub.async = function(ms, msg){
        self._ran = RanStates.Waiting.Int;
        if (timeout !== undefined){
          clearTimeout(timeout);
        }
        timeout = setTimeout(function(){
          self._ran = RanStates.Ran.Int;
          if (msg === undefined){
            msg = "Timeout";
          }
          self.pub.error(msg);
          self.pub.finish();
        }, ms);
      }

      self.dependents = [];
      // > TestObject.finish()
      self.pub.finish = function(){
        if (self._ran !== RanStates.Skip.Int){
          self.time = Date.now() - self.start;
          self._ran = RanStates.Ran.Int;
        }
        if (timeout !== undefined){
          clearTimeout(timeout);
        }
        var ln = self.dependents.length;
        var i;
        for (i=0;i<ln;i++){
          self.dependents[i](self);
        }
        self.dependents = [];
      }

      // > TestObject.passed()
      // Returns a bool indicating if the test is currently passing.
      self.pub.passed = function(){ return !self._failed; };
      self.passed = self.pub.passed;
      Object.freeze(self.pub);
      return self;
    }

    function _addTest(name, dependencies, testFunc){
      test = _Test(name, dependencies, testFunc);

      nameMap[name] = test;
      tests.push(test);
      _placeTestInHeirarchy(test);
    }

    function _placeTestInHeirarchy(test){
      var cur = _root;
      for(var i=0; i<test.nameList.length; i++){
        cur = cur.GetChild(test.nameList[i]);
      }
      if (cur.test !== undefined){
        throw new Error("Attepting to redefine " + test.name);
      }
      cur.test = test;
      test.parent = cur;
    };

    //copied from parser. Trying to avoid dependencies here.
    function _string(val){
      if (val === undefined || val === null) { return ""; }
      var type = typeof(val);
      if (type === "string") { return val; }
      if (type === "number") { return ""+val; }
      var strFromMethod;
      if ("str" in val && val.str instanceof Function) {
        strFromMethod = val.str();
      } else if ("toString" in val && val.toString instanceof Function) {
        strFromMethod = val.toString();
      }
      if (typeof strFromMethod === "string"){
        return strFromMethod;
      }
      return "" + val;
    }

    function _remove(arr, el){
      var i = arr.indexOf(el);
      if (i > -1) { arr.splice(i, 1); }
    }

    // > Result
    // Results form a tree where each Result may be associated with a test and
    // may have children. The leaves of the tree are all tests with no children.
    function _Result(group){
      var self = _Map();
      // > Result.defined
      // How many tests were defined
      self.defined = 0;
      // > Result.ran
      // How many tests ran
      self.ran = 0;
      // > Result.passed
      // How many tests passed
      self.passed = 0;
      var i,r;

      if (group.test !== undefined){
        self.defined++;
        if (group.test.ran() === RanStates.Ran.Int){
          self.ran++;
          if (group.test.passed()){
            self.passed++;
          }
        }
        // > Result.test
        // If a Result has a test, it's data is collected here
        self.test = _Map();
        // > Result.test.passed
        // True if the test passed
        self.test.passed = group.test.pub.passed;
        // > Result.test.failed
        // True if the test failed
        self.test.failed = group.test.pub.failed;
        // > Result.test.log()
        // Gets all data written to the test log while the test was running.
        self.test.log = function(){return group.test.pub.log();};
        // > Result.test.time()
        // How long the test took to run
        self.test.time = function(){return group.test.time;};
        // > Result.test.ran()
        // True if the test ran
        self.test.ran = group.test.ran;
        // > Result.test.fullName()
        // Full name, including groups
        self.test.fullName = group.test.fullName;
        // > Result.test.name
        // Returns just the test name, not the groups
        self.test.name = group.test.parent.name;
      }

      var childNames = Object.keys(group.children);
      if (childNames.length > 0){
        // > Result.children[]
        // If the Result is a group, the child tests and groups will be listed
        // here.
        self.children = _Map();
        // > Result.fullName()
        // Only set if the result is a group. It will be full group name ending
        // with "/".
        self.fullName = group.fullName;
        for(i=0; i<childNames.length; i++){
          r = _Result(group.children[childNames[i]]);
          self.children[childNames[i]] = r;
          self.defined += r.defined;
          self.ran += r.ran;
          self.passed += r.passed;
        }
      }
      // > Result.failed
      // Number of tests that failed
      self.failed = self.ran - self.passed;
      Object.freeze(self);
      return self;
    }

    // > Lapiz.Test(TestName, TestDependencies, TestFunction)
    // > Lapiz.Test(TestName, TestFunction)
    // Defines a test.

    // > TestName
    // > "name"
    // > "group/name"
    // > "group/subgroup/name"
    // A test requires a name. Test groups can be nested to an arbitrary
    // depth.

    // > TestDependencies
    // > ["name", "group/", "group/subgroup/"]
    // Dependencies is defined as a slice of strings. A string can indicate a
    // specific test or a group of tests. To indicate a group, the string should
    // end with a slash. If a dependency fails, the test will be skipped. The
    // test runner will figure out the correct order to run the tests. An error
    // will be thrown if dependencies are missing or if a circular dependency
    // exists.

    // > TestFunction
    // > function(TestObject)
    // This is the function that will be invoked when the test runs.

    // > TestObject
    // A test object will be passed into each test.

    function _TestInterface(name, funcOrDep, testFunc){
      // TestInterface checks and resolves the arguments before calling _addTest(name, dependencies, testFunc).
      // This handles the case that it accepts either (name, testFunc) or (name, dependencies, testFunc).

      // check name first, so it can be used if there are other errors
      if (typeof name !== "string"){
        throw new Error("Test) Name must be a string, got: "+(typeof name));
      }
      if (name[0] === "/" ){
        throw new Error("Test) Bad name: " + name + " - cannot begin with /");
      }
      if (name[name.length-1] === "/" ){
        throw new Error("Test) Bad name: " + name + " - cannot end with /");
      }

      // get testFunc and dependencies
      var dependencies = [];
      var i;
      if (testFunc === undefined){
        testFunc = funcOrDep;
      } else {
        dependencies = funcOrDep;
      }

      if (typeof testFunc !== "function") {
        throw new Error("Test) " + name + ": test function not defined");
      }

      if (!(dependencies instanceof Array)) {
        throw new Error("Test) "+name+": dependencies must be an array of strings");
      } else {
        for (var i = 0; i < dependencies.length; ++i) {
          if (typeof dependencies[i] !== "string"){
            throw new Error("Test) "+name+": dependencies must be an array of strings, found " + (typeof dependencies[i]) + " at "+i);
          }
       };
      }      

      _addTest(name, dependencies, testFunc);
    };
    Object.defineProperty($L, "Test", {"value":_TestInterface});
    Object.defineProperty($L.Test, "RanStates", {"value":RanStates});

    // _checkCircularDependencies makes sure the tests form an acyclic directed
    // graph. If the graph is not well formed it will throw an error.
    function _checkCircularDependencies(obj, visited){
      if (obj.circularCheck){
        return;
      }
      var fn = obj.fullName();
      if (visited.includes(fn)){
        throw new Error("Encountered circular dependency in test '"+fn+"'");
      }

      visited = visited.slice(0);
      visited.push(fn);
      var i, ln;

      if (obj.children !== undefined){
        var keys = Object.keys(obj.children);
        ln = keys.length;
        for(i=0 ; i<ln ; i++){
          _checkCircularDependencies(obj.children[keys[i]], visited);
        }
        if (obj.test != undefined){
          _checkCircularDependencies(obj.test, visited);
        }
      } else {
        var dep;
        ln = obj.dependencyNames.length;
        for(i=0 ; i<ln ; i++){
          dep = nameMap[obj.dependencyNames[i]];
          if (dep === undefined){
            throw new Error("Undefined dependency '"+obj.dependencyNames[i]+"' in test '"+fn+"'");
          }
          _checkCircularDependencies(dep, visited);
        }
      }
      obj.circularCheck = true;
    }

    function _runGroupAsync(group){
      setTimeout(function(){
        _runGroup(group);        
      }, 1);
    }

    function _runTestAsync(test){
      setTimeout(function(){
        _runTest(test);        
      }, 1);
    }

    function _runGroup(group){
      var keys = Object.keys(group.children);
      var ln = keys.length;
      var i, child;
      for (i=0;i<ln;i++){
        child = group.children[keys[i]];
        group.addDependency(child);
        _runGroupAsync(child);
      }

      if (group.test !== undefined){
        group.addDependency(group.test);
        _runTestAsync(group.test);
      }
    }

    function _runTest(test){
      var ln = test.dependencyNames.length;
      var i, dependency;
      var run = true;
      for(i=0; i<ln; i++){
        dependency = nameMap[test.dependencyNames[i]];
        if (dependency.failed() || dependency.ran() === RanStates.Skip.Int){
          test._ran = RanStates.Skip.Int;
        } else if (dependency.ran() === RanStates.NotRan.Int || dependency.ran() === RanStates.Waiting.Int){
          test.addDependency(dependency);
          run = false;
        }
      }

      if (run){
        test.run();        
      }
    }

    // > Lapiz.Test.Run()    
    // Runs all the tests and returns a Result object. The children of the
    // Result object form a tree containing all the tests.
    function _runAll(callback){
      _checkCircularDependencies(_root, []);
      _root.dependents.push(function(){
        callback(_Result(_root));
      });
      _runGroup(_root);
    };
    Object.defineProperty($L.Test, "Run", {"value":_runAll});

    var _coverageMarkers = _Map();
    var _markedFiles = _Map();
    function _registerMarkers(){
      var i;
      for(i=0; i<arguments.length; i+=1){
        if (_coverageMarkers[arguments[i]] === undefined){
          _coverageMarkers[arguments[i]] = 0;
          _markedFiles[arguments[i].split(')')[0]] = true;
        }
      }
    }
    Object.defineProperty($L.Test, "regMks", {"value":_registerMarkers});

    function _incMarker(marker){
      if (_coverageMarkers[marker] == undefined){
        _coverageMarkers[marker] = 1;
        _markedFiles[marker.split(')')[0]] = true;
      } else {
        _coverageMarkers[marker] += 1;
      }
    }
    Object.defineProperty($L.Test, "files", {"get":function(){return Object.keys(_markedFiles);}});
    Object.defineProperty($L.Test, "incMk", {"value":_incMarker});

    Object.defineProperty($L.Test, "mkrs", {"value":_coverageMarkers});

    function _coverage(file){
      var keys = Object.keys(_coverageMarkers);
      var results = {
        'hasRun': 0,
        'total': 0,
        'missed': [],
      };
      var i, marker, x;
      for(i=0; i<keys.length; i+=1){
        marker = keys[i];
        x = marker.split(')');
        if (x[0] === file){
          results.total += 1;
          if (_coverageMarkers[marker] > 0){
            results.hasRun += 1;
          } else {
            results.missed.push(x[1].trim());
          }
        }
      }
      return results;
    }
    Object.defineProperty($L.Test, "coverage", {"value":_coverage});
  }

  if (Lapiz.Module === undefined){
    TestingModule(Lapiz);
  } else {
    Lapiz.Module("Testing", TestingModule);
  }
})();