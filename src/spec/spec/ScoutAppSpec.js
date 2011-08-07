var context = function(description, specDefinitions) {
  return jasmine.getEnv().describe(description, specDefinitions);
};

function wait(millis) {
  var date = new Date();
  var curDate = null;

  do { curDate = new Date(); }
  while(curDate-date < millis);
}

describe("Compass App", function(){
  beforeEach(function() {
    // stubs
    app.createProjectBySelectingDirectory = function(callback){
      app.createProject({
        name: "project-a",
        projectDir: "/some/path/project-a"
      });
    };
    app.nukeAllProjects();
  });

  context("with no projects", function(){
    it("lists no projects", function(){
      expect($(".project").length).toBe(0);
    });
  });

  describe("adding a project", function(){
    it("adds the project to the list", function(){
      $(".option.add").click();
      expect($(".project:visible").length).toBe(1);
    });

    it("sets the project name to the folder name", function(){
      $(".option.add").click();
      Projects.get($(".project:last").attr("data-key"), function(project){
        expect(project.name).toBe("project-a");
      });
    });

    it("displays the configuration after adding the project", function(){
      $(".option.add").click();
      var project = $(".project:last");
      var visible_project_details = $(".project_details[data-key=" + project.attr('data-key') + "]:visible");
      expect(visible_project_details.length).toBe(1);
    });
  });

  describe("adding multiple projects", function(){
    beforeEach(function(){
      Projects.save({name: 'project-a'});
      app.listProjects();
    });

    it("lists both projects", function(){
      app.createProjectBySelectingDirectory = function(callback){
        app.createProject({
          name: "project-b",
          projectDir: "/some/path/project-b"
        });
      };
      $(".option.add").click();
      expect($(".project:visible").length).toBe(2);
    });
  });

  describe("switching between projects", function(){
    beforeEach(function(){
      app.createProject({
        name: "project-a",
        projectDir: "/project-a/",
        sassDir: "/project-a/sass",
        cssDir: "/project-a/css",
        javascriptsDir: "/project-a/js",
        imagesDir: "/project-a/images"
      });
      app.createProject({
        name: "project-b",
        projectDir: "/project-b/",
        sassDir: "/project-b/sass",
        cssDir: "/project-b/css",
        javascriptsDir: "/project-b/js",
        imagesDir: "/project-b/images"
      });
      app.listProjects();
    });

    context("when viewing project a and the log is selected", function() {
      beforeEach(function(){
        $(".project:contains('project-a') .source").click();
        $(".project_details:visible .mode.log").click();
      });

      it("keeps the log selected when switching to project b", function() {
        var project = $(".project:contains('project-b')");
        project.find(".source").click();
        var visible_project_details = $(".project_details.log[data-key=" + project.attr('data-key') + "]:visible");
        expect(visible_project_details.length).toBe(1);
      });
    });

    context("when viewing project a and the configuration is selected", function() {
      beforeEach(function(){
        $(".project:contains('project-a') .source").click();
        $(".project_details:visible .mode.configure").click();
      });

      it("keeps the configuration selected when switching to project b", function() {
        var project = $(".project:contains('project-b')");
        project.find(".source").click();
        var visible_project_details = $(".project_details.configure[data-key=" + project.attr('data-key') + "]:visible");
        expect(visible_project_details.length).toBe(1);
      });
    });
  });

  describe("watching a project", function(){
    beforeEach(function(){
      var project_dir = air.File.createTempDirectory(),
        sass_dir = project_dir.resolvePath("sass"),
        css_dir = project_dir.resolvePath("css");
        javascripts_dir = project_dir.resolvePath("js");
        images_dir = project_dir.resolvePath("images");
      app.createProject({
        name: "project-a",
        projectDir: project_dir.nativePath,
        sassDir: sass_dir.nativePath,
        cssDir: css_dir.nativePath,
        javascriptsDir: javascripts_dir.nativePath,
        imagesDir: images_dir.nativePath
      });
      app.listProjects();
      this.project = $(".project:contains('project-a')");
    });
    
    it("displays the project's log screen by default", function(){
      var key = this.project.attr('data-key');
      // start watching the project
      this.project.find(".start").click();
      expect($(".project_details[data-key=" + key + "] .mode.log").is(":visible")).toBe(true);
    });

    describe("logged output", function(){
      it("is empty before a project is watched", function(){
        $(".project_details:visible .mode.log").click();
        this.project.find(".source").click();

        var output = $(".project_details .log_output:visible");
        expect(output.html().length).toBe(0);
      });

      it("is updated with text that compass sends to STDOUT", function(){
        this.project.find(".source").click();
        this.project.find(".start").click();
        $(".project_details:visible .mode.log").click();

        var output = $(".project_details .log_output:visible");
        waitsFor(function(){
          return output.html().length > 0; // should no longer be empty
        }, "Did not find expected log output", 5000);
      });
    });

    context("given I have a valid project with scss files", function(){
      beforeEach(function() {

        // make the scss files to watch
        Projects.find(function (project) {
          return project.name == "project-a";
        }, function(project) {
          sassDir = new air.File(project.sassDir);
          sassDir.createDirectory();
          sassFile = sassDir.resolvePath("file.scss");
          stream = new air.FileStream();
          stream.open(sassFile, air.FileMode.WRITE);
          stream.writeUTFBytes("body { color: red; }");
          stream.close();
        });

        // start watching the project
        this.project = $(".project:contains('project-a')");
        this.project.find(".start").click();
      });
      
      describe("when I make changes to the input files", function() {
        beforeEach(function() {
          waitsFor(function(){
            var output = $(".project_details:visible .log_output");
            if(output.length === 0) return false;
            
            if(output.html().length > 0) {
              setTimeout(function(){
                Projects.find(function (project) {
                  return project.name == "project-a";
                }, function(project) {
                  sassDir = new air.File(project.sassDir);
                  sassFile = sassDir.resolvePath("file.scss");
                  stream = new air.FileStream();
                  stream.open(sassFile, air.FileMode.WRITE);
                  stream.writeUTFBytes("body { color: blue; }");
                  stream.close();
                });
              }, 1000);
              return true;
            }
            return false;
          }, "Never started logging output", 10000);
        });

        it("then I expect the output the show", function() {
          //assert that the log output has some text
          var output = $(".project_details:visible .log_output");
          waitsFor(function(){
            if(output.length === 0) return false;
            return output.html().match(/overwrite/);
          }, "Overwrite never found.", 10000);
        });
      });
    });
  });

});
