(function() {
  // Current selected group
  var selected = false;

  var init = function() {
    // Tasks
    var colors = d3.scale.category20();

    d3.selectAll("div.roadmap").each(function() {
      var tasks = [];
      var people = [];
      var currentTask = {};

      lines = (this.textContent || this.innerHTML || "").split("\n");
      for (var j = 0, line; line = lines[j], j < lines.length; j++) {
        line = line.replace(/^\s+|\s+$/g, '');

        // 1st line, project name followed by task name
        if (!currentTask.name && !currentTask.group) {
          texts = line.split(",");
          currentTask.type = "task";
          currentTask.group = texts[0];
          currentTask.name = texts.slice(1).join(",");
          currentTask.color = colors(currentTask.group);
          continue;
        }

        // 2nd line, dates from and to
        if (!currentTask.from && !currentTask.to) {
          texts = line.replace(/[^0-9\-\/]+/, ' ').split(' ');
          currentTask.from = texts[0];
          currentTask.to = texts[1];
          continue;
        }

        // next lines, people
        if (line !== "") {
          people.push({
            type: "people",
            group: line,
            from: currentTask.from,
            to: currentTask.to,
            name: currentTask.group + " — " + currentTask.name,
            taskGroup: currentTask.group,
            color: colors(currentTask.group)
          });
          continue;
        }

        // last line, empty
        if (line === "" && currentTask.name) {
          tasks.push(currentTask);
          currentTask = {};
          continue;
        }
      }

      if (tasks.length > 0) {
        this.innerHTML = "";
        var options = draw(this, tasks, {});
        people.sort(function(a, b) {
          return a.group > b.group ? 1 : -1;
        });
        if (people.length > 0) {
          draw(this, people, options);
        }
      }
    });

  };

  var draw = function(node, items, options) {
    // For d3
    var dateFormat = d3.time.format("%Y-%m-%d");

    // Drawing
    var barHeight = 20;
    var gap = barHeight + 4;
    var topPadding = 20;

    // Init width and height
    var h = items.length * gap + topPadding + 40;
    var w = node.clientWidth;

    // Init d3
    var svg = d3.select(node)
      .append("svg")
      .attr("width", w)
      .attr("height", h)
      .attr("style", "overflow: visible");

    // Sort items
    items.sort(function(a, b) {
      if (a.group === b.group) {
        return dateFormat.parse(a.from) > dateFormat.parse(b.from) ? 1 : -1;
      } else {
        return a.group > b.group ? 1 : -1;
      }
    });

    // Filter groups
    var groups = [];
    var total = 0;
    for (var i = 0; i < items.length; i++){
      var j = 0;
      var found = false;
      while (j < groups.length && !found) {
        found = (groups[j].name === items[i].group);
        j++;
      }
      if (!found) {
        var count = 0;
        j = 0;
        while (j < items.length) {
          if (items[j].group == items[i].group) {
            count++;
          }
          j++;
        }
        groups.push({
          type: "group",
          name: items[i].group,
          count: count,
          previous: total
        });
        total += count;
      }
    }

    // Draw vertical group boxes
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

    var sidePadding = options.sidePadding || axisText[0].parentNode.getBBox().width + 15;

    // Init time scale
    var timeScale = d3.time.scale()
      .clamp(true)
      .domain([
        d3.min(items, function(d) {
          return dateFormat.parse(d.from);
        }),
        d3.max(items, function(d) {
          var date = dateFormat.parse(d.to);
          return date.setHours(date.getHours() + 24);
        })
      ]).range([0, w - sidePadding - 15]);

    // Init X Axis
    var xAxis = d3.svg.axis()
      .scale(timeScale)
      .orient('bottom')
      .ticks(d3.time.monday)
      .tickSize(-h + topPadding + 20, 0, 0)
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
      .attr("stroke", "#dddddd")
      .attr("shape-rendering", "crispEdges");

    // Items group
    var rectangles = svg.append('g')
      .selectAll("rect")
      .data(items)
      .enter();

    // Draw items boxes
    rectangles.append("rect")
      .attr("class", function(d) {
        return "item " + makeSafeForCSS(getGroupName(d));
      })
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
        return d.color;
      })
      .attr("fill-opacity", 0.5)
      .on("mouseover", function() {
        d3.select(this).style({cursor:'pointer'});
      })
      .on('click', selectOneGroup);

    // Draw items texts
    rectangles.append("text")
      .attr("class", function(d) {
        return "item " + makeSafeForCSS(getGroupName(d));
      })
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
      .attr("fill", "#000")
      .style("pointer-events", "none");

    // Draw vertical mouse helper
    var verticalMouse = svg.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 0)
      .style("stroke", "black")
      .style("stroke-width", "1px")
      .style("stroke-dasharray", "2,2")
      .style("shape-rendering", "crispEdges")
      .style("pointer-events", "none")
      .style("display", "none");

    var verticalMouseBox = svg.append("rect")
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("width", 50)
      .style("height", barHeight)
      .style("stroke", "none")
      .style("fill", "black")
      .style("fill-opacity", 0.8)
      .style("display", "none");

    var verticalMouseText = svg.append("text")
      .style("font-size", 11)
      .style("font-weight", "bold")
      .style("text-anchor", "middle")
      .style("text-height", barHeight)
      .style("fill", "white")
      .style("display", "none");

    var verticalMouseTopPadding = 40;

    svg.on("mousemove", function () {
      var xCoord = d3.mouse(this)[0],
          yCoord = d3.mouse(this)[1];

      if (xCoord > sidePadding) {
        verticalMouse
            .attr("x1", xCoord)
            .attr("y1", topPadding - 10)
            .attr("x2", xCoord)
            .attr("y2", h - 30)
            .style("display", "block");

        verticalMouseBox
            .attr("x", xCoord - 25)
            .attr("y", yCoord - (barHeight + 8) / 2 + verticalMouseTopPadding)
            .style("display", "block");

        verticalMouseText
            .attr("transform", "translate(" + xCoord + "," + (yCoord + verticalMouseTopPadding) + ")")
            .text(d3.time.format('%b %d')(timeScale.invert(xCoord - sidePadding)))
            .style("display", "block");
      } else {
        verticalMouse.style("display", "none");
        verticalMouseBox.style("display", "none");
        verticalMouseText.style("display", "none");
      }
    });

    svg.on("mouseleave", function() {
      verticalMouse.style("display", "none");
      verticalMouseBox.style("display", "none");
      verticalMouseText.style("display", "none");
    });

    return {
      sidePadding: sidePadding
    };
  };

  function getGroupName(d) {
    switch (d.type) {
      case "people":
        return d.taskGroup;
      case "task":
        return d.group;
      case "group":
        return d.name;
    }
  }

  function selectOneGroup(d) {
    var klass = makeSafeForCSS(getGroupName(d));

    if (selected === klass) {
      d3.selectAll(".item").style("opacity", 1);
      selected = false;
    } else {
      d3.selectAll(".item").style("opacity", 0.2);
      d3.selectAll("." + klass).style("opacity", 1);
      selected = klass;
    }
  }

  function makeSafeForCSS(name) {
      return "_" + name.toLowerCase().replace(/[^a-z0-9]+/g, function(s) {
          return '-';
      });
  }

  document.addEventListener('DOMContentLoaded', function(){
    if(typeof window.Roadmap === 'undefined') {
      init();
    }
    window.Roadmap = {
      init: init
    };
  });

})();
