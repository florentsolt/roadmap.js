(function() {

  var init = function() {
    // Tasks

    d3.selectAll("div.roadmap").each(function() {
      var tasks = [];
      var currentTask = {};

      lines = (this.textContent || this.innerHTML || "").split("\n");
      for (var j = 0, line; line = lines[j], j < lines.length; j++) {
        line = line.replace(/^\s+|\s+$/g, '');

        if (!currentTask.name && !currentTask.group) {
          texts = line.split(",");
          currentTask.group = texts[0];
          currentTask.name = texts.slice(1).join(",");
          continue;
        }

        if (!currentTask.from && !currentTask.to) {
          texts = line.replace(/[^0-9\-\/]+/, ' ').split(' ');
          currentTask.from = texts[0];
          currentTask.to = texts[1];
          continue;
        }

        if (line === "" && currentTask.name) {
          tasks.push(currentTask);
          currentTask = {};
          continue;
        }
      }
      if (tasks.length > 0) {
        this.innerHTML = "";
        draw(this, tasks);
      }
    });
  };

  var draw = function(node, tasks) {
    // For d3
    var colors = d3.scale.category10();
    var dateFormat = d3.time.format("%Y-%m-%d");

    // Drawing
    var barHeight = 20;
    var gap = barHeight + 4;
    var topPadding = 20;

    // Init width and height
    var h = tasks.length * gap + topPadding + 40;
    var w = node.clientWidth;

    // Init d3
    var svg = d3.select(node)
      .append("svg")
      .attr("width", w)
      .attr("height", h)
      .attr("style", "overflow: visible");

    // Init time scale
    var timeScale = d3.time.scale()
      .clamp(true)
      .domain([
        d3.min(tasks, function(d) {
          return dateFormat.parse(d.from);
        }),
        d3.max(tasks, function(d) {
          var date = dateFormat.parse(d.to);
          return date.setHours(date.getHours() + 24);
        })
      ]).range([0, w - 150]);

    // Filter groups
    var groups = [];
    var total = 0;
    for (var i = 0; i < tasks.length; i++){
      var j = 0;
      var found = false;
      while (j < groups.length && !found) {
        found = (groups[j].name === tasks[i].group);
        j++;
      }
      if (!found) {
        var count = 0;
        j = 0;
        while (j < tasks.length) {
          if (tasks[j].group == tasks[i].group) {
            count++;
          }
          j++;
        }
        groups.push({
          name: tasks[i].group,
          count: count,
          previous: total
        });
        total += count;
      }
    }

    // Draw vertical boxes
    svg.append("g")
      .selectAll("rect")
      .data(groups)
      .enter()
      .append("rect")
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("x", 0)
      .attr("y", function(d, i){
        return d.previous * gap + topPadding;
      })
      .attr("width", function(d){
        return w;
      })
      .attr("height", function(d, i) {
        return d.count * gap - 4;
      })
      .attr("stroke", "none")
      .attr("fill", "#999")
      .attr("fill-opacity", 0.1);

    // Draw vertical labels
    var axisText = svg.append("g")
      .selectAll("text")
      .data(groups)
      .enter()
      .append("text")
      .text(function(d){
        return d.name;
      })
      .attr("x", 10)
      .attr("y", function(d, i){
        return d.count * gap / 2 + d.previous * gap + topPadding;
      })
      .attr("font-size", 11)
      .attr("text-anchor", "start")
      .attr("text-height", 14)
      .attr("fill", "#000");

    var sidePadding = axisText[0].parentNode.getBBox().width + 15;

    // Init X Axis
    var xAxis = d3.svg.axis()
      .scale(timeScale)
      .orient('bottom')
      .ticks(d3.time.monday)
      .tickSize(-h + topPadding + 40, 0, 0)
      .tickFormat(d3.time.format('%b %d'));

    // Draw vertical grid
    var xAxisGroup = svg.append('g')
      .attr('transform', 'translate(' + sidePadding + ', ' + (h - 30) + ')')
      .call(xAxis);

    // Now
    var now = new Date();
    if (now > timeScale.domain()[0] && now < timeScale.domain()[1]) {
      xAxisGroup
        .append("line")
        .attr("x1", timeScale(now))
        .attr("y1", 0)
        .attr("x2", timeScale(now))
        .attr("y2", -h + topPadding + 20)
        .attr("class", "now");

      xAxisGroup.selectAll('.now')
        .attr("stroke", "red")
        .attr("opacity", 0.5)
        .attr("stroke-dasharray", "2,2")
        .attr("shape-rendering", "crispEdges");
    }

    xAxisGroup.selectAll("text")
      .style("text-anchor", "middle")
      .attr("fill", "#000")
      .attr("stroke", "none")
      .attr("font-size", 10)
      .attr("dy", "1em");

    xAxisGroup.selectAll('.tick line')
      .attr("stroke", "lightgrey")
      .attr("shape-rendering", "crispEdges");

    // Tasks group
    var rectangles = svg.append('g')
      .selectAll("rect")
      .data(tasks)
      .enter();

    // Draw tasks boxes
    rectangles.append("rect")
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("x", function(d){
        return timeScale(dateFormat.parse(d.from)) + sidePadding;
      })
      .attr("y", function(d, i){
        return i * gap + topPadding;
      })
      .attr("width", function(d){
        var end = dateFormat.parse(d.to);
        end.setHours(end.getHours() + 24);
        return timeScale(end) - timeScale(dateFormat.parse(d.from));
      })
      .attr("height", barHeight)
      .attr("stroke", "none")
      .attr("fill", function(d) {
        for (var i = 0; i < groups.length; i++){
          if (d.group == groups[i].name){
            return colors(i);
          }
        }
      })
      .attr("fill-opacity", function(d) {
        var opacity = 1;
        for (var i = 0; i < tasks.length; i++){
          if (d == tasks[i]) {
            return Math.max(opacity, 0.1);
          }
          if (d.group == tasks[i].group){
            opacity -= 0.3;
          }
        }
      });

    // Draw tasks texts
    rectangles.append("text")
      .text(function(d){
        return d.name;
      })
      .attr("x", function(d){
        return (timeScale(dateFormat.parse(d.to)) - timeScale(dateFormat.parse(d.from))) / 2 +
          timeScale(dateFormat.parse(d.from)) + sidePadding;
      })
      .attr("y", function(d, i){
        return i * gap + 14 + topPadding;
      })
      .attr("font-size", 11)
      .attr("text-anchor", "middle")
      .attr("text-height", barHeight)
      .attr("fill", "#000");
  };

  document.addEventListener('DOMContentLoaded', function(){
    if(typeof window.Roadmap === 'undefined') {
      init();
    }
    window.Roadmap = {
      init: init
    };
  });

})();
