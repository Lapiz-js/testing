/**
 * @namespace Lapiz
 */
var Lapiz = (function($L) {
  return $L || Object.create(null);
}(Lapiz));

/**
 * @namespace SetupTestModule
 */
(function SetupTestModule(){
  /**
   * @namespace TestModule
   * @memberof Lapiz
   */
  var TestingModule = function($L){
    // We're using Object.create(null) as a map, this makes it a little cleaner to read
    function _Map(){
      return Object.create(null);
    }

    /**
     * testnameMap maps the name of the test or group to the instance. This makes is
     * easier to retreive by name than splitting the name by / are recursing
     * through the heirarchy
     */
    var nameMap = _Map();

    /**
     * test is a list of all the test, it does not include groups
     */
    var tests = [];

    /**
     * @constructor _Group
     * @param name should be string ending, except for root
     */
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
      self.pub.log = function(){
        return _log(self, arguments);
      };
      self.pub.fail = function(){
        self.failed = true;
      };
      self.pub.error = function(){
        self._failed = true;
        _log(self, arguments);
      };
      self.pub.failed = function(){ return self._failed; };
      self.failed = self.pub.failed;
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

    /**
     * TestInterface checks and resolves the arguments before calling _addTest(name, dependencies, testFunc).
     * This handles the case that it accepts either (name, testFunc) or (name, dependencies, testFunc).
     */
    $L.Test = function TestInterface(name, funcOrDep, testFunc){
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
        if (typeof funcOrDep === "function") {
          testFunc = funcOrDep;
        } else {
          throw new Error(name+": test function not defined");
        }
      } else {
        if (!(funcOrDep instanceof Array)) {
          throw new Error("Test) "+name+": dependencies must be an array of strings");
        } else {
          for (var i = 0; i < funcOrDep.length; ++i) {
            if (typeof funcOrDep[i] !== "string"){
              throw new Error("Test) "+name+": dependencies must be an array of strings, found " + (typeof funcOrDep[i]) + " at "+i);
            }
            dependencies.push(funcOrDep[i]);
         };
        }
        if (typeof testFunc !== "function") {
          throw new Error("Test) " + name + ": test function not defined");
        }
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

      function _Result(group){
        var self = _Map();
        self.defined = 0;
        self.ran = 0;
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
          self.test = _Map();
          self.test.passed = group.test.pub.passed;
          self.test.failed = group.test.pub.failed;
          self.test.log = function(){return group.test.pub.log();};
          self.test.time = function(){return group.test.time;};
          self.test.ran = group.test.ran;
          self.test.fullName = group.test.fullName;
          self.test.name = group.test.parent.name;
        }

        var childNames = Object.keys(group.children);
        if (childNames.length > 0){
          self.children = _Map();
          self.fullName = group.fullName;
          for(i=0; i<childNames.length; i++){
            r = _Result(group.children[childNames[i]]);
            self.children[childNames[i]] = r;
            self.defined += r.defined;
            self.ran += r.ran;
            self.passed += r.passed;
          }
        }
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
              test.pub.error(err.message + "<pre>" + err.stack + "</pre>");
              console.error(err.message + "\n" + err.stack);
            } else {
              test.pub.error("<pre>" + err.stack + "</pre>");
              console.error(err.stack);
            }
          }
          test._ran = true;
          test.time = Date.now() - s;
        }
      }

      $L.Test.Run = function(){
        _resolveDependancies(_root);
        var plan = [];
        _schedule(_root, plan, []);
        var i, s;
        //TODO: break this up with work queue
        for(i=0; i<plan.length; i++){
          _run(plan[i]);
        }
        return _Result(_root);
      }

      _addTest(name, dependencies, testFunc);
    };
  };

  if (Lapiz.Module === undefined){
    TestingModule(Lapiz);
  } else {
    Lapiz.Module("Testing", TestingModule);
  }
})();