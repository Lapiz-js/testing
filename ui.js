(function SetupTestingUI() {

  var TestingUIModule = function(){
    document.addEventListener("DOMContentLoaded", function(){
      var results = Lapiz.Test.Run();

      var overall = "Passed";
      var out = [];
      if (results.defined !== results.passed){
        out.push("<h1 class='Failed'> Of " + results.defined + " tests, " + results.ran + " ran and " + results.passed + " passed </h1>");
      } else {
        out.push("<h1 class='Passed'>" + results.defined + " Passed </h1>");
      }

      appendGroupToOut(results, out)

      document.getElementsByTagName("body")[0].innerHTML = out.join("");
    });

    function appendGroupToOut(group, out){
      if (group.children !== undefined){
        if (group.defined !== group.passed){
          out.push("<div class='Failed group'>")
        } else {
          out.push("<div class='Passed group'>")
        }
        var fullName = group.fullName();
        if (fullName.length > 0){
          out.push("<h2>"+fullName.substr(0,fullName.length-1)+"</h2>");
        }
        appendLogToOut(group);
        var childNames = Object.keys(group.children);
        for(var i=0; i<childNames.length; i++){
          appendGroupToOut(group.children[childNames[i]], out);
        }
        out.push("</div>");
      } else {
        var t = "x"
        if (!group.test.ran()){
          out.push("<div class='DidNotRun test'>");
        } else if (group.test.passed()){
          out.push("<div class='Passed test'>");
          t = group.test.time() +" ms";
        } else {
          out.push("<div class='Failed test'>");
          t = group.test.time() +" ms";
        }
        out.push("<span class='testName'>"+group.test.name + "</span>"+t);
        appendLogToOut(group, out);
        out.push("</div>");
      }
    }

    function appendLogToOut(group, out){
      var log;
      if (group.test != undefined){
        log = group.test.log();
      }
      if (log !== undefined && log.length > 0){
        out.push("<ul>")
        for(var i=0; i<log.length; i++){
          out.push("<li>"+log[i]+"</li>");
        }
        out.push("</ul>")
      }
    }
  };

  if (Lapiz.Module === undefined){
    console.log("Bar");
    TestingUIModule(Lapiz);
  } else {
    Lapiz.Module("TestingUI", ["Testing"], TestingUIModule);
  }
})();
