(function SetupTestingUI() {

  var TestingUIModule = function(){
    // add 10ms delay to give UI tests a chance to run
    document.addEventListener("DOMContentLoaded", function(){
      setTimeout(function(){
        var callback = function(results){
          var overall = "Passed";
          var out = [];
          if (results.defined !== results.passed){
            out.push("<h1 class='Failed'> Of " + results.defined + " tests, " + results.ran + " ran and " + results.failed + " <a href='#firstFailure'>failed</a>");
          } else {
            out.push("<h1 class='Passed'>" + results.defined + " Passed");
          }

          out.push("<span id='coverage'></span></h1>")

          appendGroupToOut(results, out);
          appendCoverageToOut(out);

          document.getElementsByTagName("body")[0].innerHTML+= out.join("");

          var firstFailure = document.querySelector(".Failed.test");
          if (firstFailure){
            var ffa = document.createElement("a");
            ffa.setAttribute('name', 'firstFailure');
            firstFailure.parentNode.insertBefore(ffa,firstFailure);
          }
        };
        Lapiz.Test.Run(callback);
      }, 10);
    });

    function appendCoverageToOut(out){
      var totalRun = 0;
      var totalMarkers = 0;
      var files = Lapiz.Test.files;
      if (files.length > 0){
        out.push("<h1><a name='beginCoverage'></a>Coverage</h1>")
      }
      var keys = Object.keys(files);
      var l = keys.length;
      var i,j,key, file, ml, missed;
      for(i=0; i<files.length; i+=1){
        key = keys[i];
        file = files[key];
        var coverage = Lapiz.Test.coverage(file)
        totalRun += coverage.hasRun;
        totalMarkers += coverage.total;
        var passed = (coverage.hasRun === coverage.total) ? " Passed" : "";
        out.push("<div class='group"+passed+"'>")
        out.push("<h2>"+file+": "+coverage.hasRun+"/"+coverage.total+"</h2><ul>");
        missed = coverage.missed;
        ml = missed.length;
        for(j=0; j<ml; j++){
          out.push("<li>"+missed[j].replace(" : 0","")+"</li>");
        }
        out.push("</ul></div>")
      }
      setTimeout(function(){
        if (totalMarkers > 0){
          var percent = Math.round((100*totalRun)/totalMarkers);
          document.getElementById("coverage").innerHTML = "<a href='#beginCoverage'>Coverage: " + totalRun + "/"+totalMarkers + "(" + percent + "%)</a>";
        }
      }); //bit of a hack
    }

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
        if (group.test.ran() !== Lapiz.Test.RanStates.Ran.Int){
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
    TestingUIModule(Lapiz);
  } else {
    Lapiz.Module("TestingUI", ["Testing"], TestingUIModule);
  }
})();
