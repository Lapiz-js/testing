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

    
    // testnameMap maps the name of the test or group to the instance. This makes is
    // easier to retreive by name than splitting the name by / are recursing
    // through the heirarchy
    var nameMap = _Map();

    // test is a list of all the test, it does not include groups
    var tests = [];

    // _Group is not exposed, it is just used internally to handle dependancies
    function _Group(name, parent){
      var self = _Map();

      self.name = name;
      self.scheduled = false;
      self.circularCheck = false;

      self.parent = parent;
      self.children = _Map();
      self.fullName = function(){
        return self.parent.fullName() + self.name + "/";
      }

      /**
       * @method GetChild returns a child by name, creates the child if it doesn't
       * exist.
       */
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
      self.passed = function(){
        var childNames = Object.keys(self.children);
        var passed = true;
        var i;
        for(i=0; i<childNames.length; i++){
          if (!self.children[childNames[i]].passed()){
            passed = false;
          }
        }
        if (passed && self.test !== undefined){
          passed = self.test.passed();
        }
        return passed;
      };

      self.ran = function(){
        var childNames = Object.keys(self.children);
        var ran = true;
        var i;
        for(i=0; i<childNames.length; i++){
          if (!self.children[childNames[i]].ran()){
            ran = false;
          }
        }
        if (ran && self.test !== undefined){
          ran = self.test.ran();
        }
        return ran;
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
      self.dependencies = [];
      self.func = testFunc;
      self._ran = false;
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

    function _linkDependancy(dependant, dependency){
      dependant.dependencies.push(dependency);
    }

    /**
     * _resolveDependancies links all the dependencies that were given by name
     * and links them to the actual test.
     */
    function _resolveDependancies(group){
      var childNames = Object.keys(group.children);
      var i, child;
      for (i=0; i<childNames.length;i++){
        child = group.children[ childNames[i] ];
        _resolveDependancies(child);
      }

      // if this group contains a test, resolve it's dependencies
      var test = group.test;
      if (test !== undefined){
        for(i=0; i<test.dependencyNames.length; i++){
          dependency = nameMap[test.dependencyNames[i]];
          if (dependency === undefined){
            throw new Error("Test) Undefined dependency " + test.dependencyNames[i] + " in test " + test.name);
          }
          _linkDependancy(test, dependency);
        }
        dependencies = test.dependencies.slice(0); //copy
      }
    }

    function _schedule(group, schedule, dependents){
      if (dependents.indexOf(group) !== -1){
        throw new Error("Found circular dependency in " + group.fullName());
      }
      if (group.scheduled){
        return;
      }
      group.scheduled = true;

      var i, childNames;
      var idx = dependents.length;
      dependents.push(group);
      //check dependencies
      if (group.dependencies !== undefined){
        for(i=0; i<group.dependencies.length; i++){
          _schedule(group.dependencies[i], schedule, dependents);
        }
      }
      //check children
      if (group.children !== undefined){
        childNames = Object.keys(group.children);
        for(i=0; i<childNames.length; i++){
          _schedule(group.children[childNames[i]], schedule, dependents);
        }
      }

      //check self
      if (group.test !== undefined){
        _schedule(group.test, schedule, dependents);
      }
      dependents.splice(idx, 1);

      if (group.func !== undefined){
        schedule.push(group);
      }
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
        if (group.test.ran()){
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

    function _run(test){
      var i, dependency;
      var run = true;
      for(i=0; i<test.dependencies.length; i++){
        dependency = test.dependencies[i];
        if (!dependency.ran() || dependency.failed()){
          run = false;
          break;
        }
      }
      if (run){
        var s = Date.now();
        try {
          test.func(test.pub);
        } catch(err) {
          if (err.message){
            console.error(err);
            console.log(err.stack);
            test.pub.error(err.message + "<pre>" + err.stack + "</pre>");
          } else {
            console.error(err.stack);
            test.pub.error("<pre>" + err.stack + "</pre>");
          }
        }
        test._ran = true;
        test.time = Date.now() - s;
      }
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

    // > Lapiz.Test.Run()    
    // Runs all the tests and returns a Result object. The children of the
    // Result object form a tree containing all the tests.
    function _runAll(){
      _resolveDependancies(_root);
      var plan = [];
      _schedule(_root, plan, []);
      var i, s;
      //TODO: break this up with work queue
      for(i=0; i<plan.length; i++){
        _run(plan[i]);
      }
      return _Result(_root);
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