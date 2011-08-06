Array.prototype.last = function() {return this[this.length-1];}

var Projects = new Lawnchair({adaptor: 'air', table: "projects"+ENV});

var app = {
  delegateTo: function(targetMethod){
    return function(evnt){
      app[targetMethod](evnt);
    };
  },

  initialize: function() {
    app.listProjects();
  },

  createProjectBySelectingDirectory: function() {
    browseDirectories(air.File.userDirectory.nativePath, function(evnt) {
      if(air.Capabilities.os.match(/Windows/)) {
        app.createProject({
          name: evnt.target.nativePath.replace(/\\$/, '').split('\\').last(),
          projectDir: evnt.target.nativePath
        });
      } else {
        app.createProject({
          name: evnt.target.nativePath.replace(/\/$/, '').split('/').last(),
          projectDir: evnt.target.nativePath
        });
      }
    });
  },

  createProjectByDroppingADirectory: function(evnt){
    evnt.preventDefault();
    directoryPath = evnt.dataTransfer.getData("text/uri-list");
    app.createProject({
      name: directoryPath.replace(/\/$/, '').split('/').last(),
      projectDir: directoryPath
    });
  },

  createProject: function(options) {
    var defaults = {
      name:"",
      projectDir:"",
      sassDir:"",
      cssDir:"",
      javascriptsDir:"",
      imagesDir:"",
      environment:"development",
      outputStyle: "expanded"
    };

    options = $.extend(defaults, options);

    Projects.save({
      name: options.name,
      projectDir: options.projectDir,
      sassDir: options.sassDir,
      cssDir: options.cssDir,
      javascriptsDir: options.javascriptsDir,
      imagesDir: options.imagesDir,
      environment: options.environment,
      outputStyle: options.outputStyle
    }, function(project){
      $('.projects').trigger(':changed');
      $('.project[data-key='+project.key+']').trigger(':select_and_configure');
    });
  },

  listProjects: function() {
    $('.projects').empty();
    Projects.all(function(projects) {
      $.each(projects, function(i, project){
        if(project) {
          // add project to project_list
          $.tmpl($("#project_template"), project).appendTo(".projects");
          // add project details pane
          if($('.project_details[data-key='+project.key+']').length == 0){
            $.tmpl($("#project_details_template"), project).appendTo("body");

            $('.project_details[data-key='+project.key+']').find("option[data-environment=" + project.environment + "]").attr("selected", "selected");
            $('.project_details[data-key='+project.key+']').find("option[data-output_style=" + project.outputStyle + "]").attr("selected", "selected");
          }
        }
      });
    });
  },

  nukeAllProjects: function(){
    Projects.all(function(projects) {
      $.each(projects, function(i, project){
        if(project){
          $('.project[data-key=' + project.key + ']').remove();
          $('.project_details[data-key=' + project.key + ']').remove();
        }
      });
    });
    Projects.nuke();
    $('.projects').trigger(':changed');
    $('.projects').trigger('processes:killAll');
    $('.project_details').hide();
    $('.non_selected').show();
  },

  viewProjectConfiguration: function() {
    $('.pane.project_details').show();
    $('.pane.project_details').addClass('configure');
    $('.pane.project_details').removeClass('log');
  },

  viewProjectLog: function() {
    $('.pane.project_details').removeClass('configure');
    $('.pane.project_details').addClass('log');
  }

};

// UI stuff
$(document).ready(function() {
  $.tmpl($('#colorize_template'));
  $.tmpl($('#project_template'));
  $.tmpl($('#project_details_template'));

  // create new project
  $('.option.add').live('click', app.delegateTo('createProjectBySelectingDirectory'));

  $('.content').live('drop', app.createProjectByDroppingADirectory);
  $('.projects').live(':changed', app.listProjects);

  $('.project').live(':started', projectStarted);
  $('.project').live(':stopped', projectStopped);
  $('.project').live(':select', selectProject);
  $('.project').live(':select_and_configure', selectProjectConfiguration);

  $('.project_details').live(':newLogOutput', updateProjectLog);

  $('.modes .mode.configure').live('click', app.viewProjectConfiguration);
  $('.modes .mode.log').live('click', app.viewProjectLog);

  // start/stop project
  $('.project .start').live('click', startWatchingProject);
  $('.project .stop').live('click', stopWatchingProject);
  
  $('.select_sass_dir').live('click', selectSassDirBySelectingDirectory);
  $('.select_css_dir').live('click', selectCssDirBySelectingDirectory);
  $('.select_javascripts_dir').live('click', selectJavascriptsDirBySelectingDirectory);
  $('.select_images_dir').live('click', selectImagesDirBySelectingDirectory);
  $('.select_environment').live('change', selectEnvironment);
  $('.select_output_style').live('change', selectOutputStyle);
  $('.project_details .delete').live('click', deleteProject);

  //TODO: make sure this goes to configure
  $('.project .item').live('click', function() {
    var key = $(this).parents('.project:first').attr('data-key');
    $('.project[data-key='+key+']').trigger(':select');
  });
  
  // clicking play should go to log screen
  

  $('#nuke').live('click', app.delegateTo('nukeAllProjects'));
  
  function updateProjectLog(evnt, data) {
    var key = $(this).attr('data-key');
    $('.project_details[data-key='+key+'] .log_output').append(colorize(data.replace("\n", "<br />")));
  }

  function selectProject() {
    $('.project').removeClass('selected');
    $(this).addClass('selected');
    $('.project_details').hide();
    $('.project_details[data-key='+$(this).data('key')+']').show();
  }

  function selectProjectConfiguration(){
    $(this).trigger(":select");
    app.viewProjectConfiguration();
  }

  var colors = {
    "33": "yellow",
    "32": "green",
    "31": "red",
    "0": ""
  }

  function colorize(string) {
    new_string = string.replace(/\033\[(\d+)m([^\033]+)\033\[0m/g, function(match, color, string, offset, original) {
      thing = $.tmpl($('#colorize_template'),  { color: colors[color], string: string }).html();
      return thing;
    });
    return new_string.replace(/\033\[(\d+)m/g, '');
  }

  function startWatchingProject() {
    var project_container = $(this).parents('.project:first');
    key = project_container.attr('data-key');
    Projects.get(key, function(project) {
      setProjectState(project_container, "starting");
      project_container.trigger("watch:start", { project: project });
    });
    $('.project[data-key='+key+']').trigger(':select');
    app.viewProjectLog();
    return false;
  }

  function stopWatchingProject(){
    var project_container = $(this).parents('.project:first');
    key = project_container.attr('data-key');
    Projects.get(key, function(project) {
      setProjectState(project_container, "stopping");
      project_container.trigger("watch:stop", { project: project });
    });
    return false;
  }

  function setProjectState(project, state){
    $(project).removeClass("starting")
      .removeClass("stopping")
      .removeClass("started")
      .removeClass("stopped")
      .addClass(state);
  };

  function projectStopped() {
    setProjectState(this, "stopped");
  }

  function projectStarted() {
    setProjectState(this, "started");
  }

  app.initialize();
});


function deleteProject() {
  key = $(this).parents('.project_details:first').attr('data-key');
  Projects.get(key, function(project) {
    Projects.remove(project);
  });
  $('.project[data-key='+key+']:first').trigger('watch:stop');
  $('.projects').trigger(':changed');

  $('.project_details').hide();
  $('.non_selected').show();

  return false;
}

function selectCssDirBySelectingDirectory() {
  key = $(this).parents('.project_details:first').attr('data-key');
  Projects.get(key, function(project) {
    browseDirectories(project.projectDir, function(evnt){
      project.cssDir = evnt.target.nativePath;
      Projects.save(project);
      $('.project_details[data-key='+key+'] .css_dir').val(evnt.target.nativePath);
    });
  });
  return false;
}

function selectSassDirBySelectingDirectory() {
  key = $(this).parents('.project_details:first').attr('data-key');
  Projects.get(key, function(project) {
    browseDirectories(project.projectDir, function(evnt){
      project.sassDir = evnt.target.nativePath;
      Projects.save(project);
      $('.project_details[data-key='+key+'] .sass_dir').val(evnt.target.nativePath);
    });
  });
  return false;
}

function selectJavascriptsDirBySelectingDirectory() {
  key = $(this).parents('.project_details:first').attr('data-key');
  Projects.get(key, function(project) {
    browseDirectories(project.projectDir, function(evnt){
      project.javascriptsDir = evnt.target.nativePath;
      Projects.save(project);
      $('.project_details[data-key='+key+'] .javascripts_dir').val(evnt.target.nativePath);
    });
  });
  return false;
}

function selectImagesDirBySelectingDirectory() {
  key = $(this).parents('.project_details:first').attr('data-key');
  Projects.get(key, function(project) {
    browseDirectories(project.projectDir, function(evnt){
      project.imagesDir = evnt.target.nativePath;
      Projects.save(project);
      $('.project_details[data-key='+key+'] .images_dir').val(evnt.target.nativePath);
    });
  });
  return false;
}

function selectEnvironment() {
  var project_details = $(this).parents('.project_details:first');
  var key = project_details.attr('data-key');
  Projects.get(key, function(project) {
    var environment = $(project_details).find('select.select_environment option:selected').attr('data-environment');
    project.environment = environment;
    Projects.save(project);
  });

  return false;
}

function selectOutputStyle() {
  var project_details = $(this).parents('.project_details:first');
  var key = project_details.attr('data-key');
  Projects.get(key, function(project) {
    var output_style = $(project_details).find('select.select_output_style option:selected').attr('data-output_style');
    project.outputStyle = output_style;
    Projects.save(project);
  });

  return false;
}

function browseDirectories(initialPath, callback) {
  var directory = new air.File(initialPath);
  try
  {
    directory.browseForDirectory("Select Directory");
    directory.addEventListener(air.Event.SELECT, callback);
  }
  catch (error)
  {
    air.trace("Failed:", error.message)
  }
}