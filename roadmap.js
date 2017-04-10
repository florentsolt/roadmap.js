(function() {
  var tasks = [];
  var people = [];
  var node = null;

  var refresh = function(filter, topPadding) {
    if (tasks.length > 0) {
      node.style.minHeight = node.clientHeight + "px";
      node.innerHTML = "";
      if (filter) {
        topPadding = topPadding < 150 ? 0 : topPadding - 150;
        node.innerHTML = "<a style='margin: 5px; margin-top: " + topPadding + "px; display: inline-block; float: right; border-radius: 3px; color: #fff; font-size: 12px; background: #999; padding: 6px 20px 6px 20px; text-decoration: none;' href='javascript:' onclick='Roadmap.refresh()'>&larr; Back to the full roadmap</a>";
      }

      var options = draw(node, tasks.filter(function(task) {
        if (filter && task.group !== filter) {
          return false;
        } else {
          return true;
        }
      }), {});

      people.sort(function(a, b) {
        return a.group > b.group ? 1 : -1;
      });

      if (people.length > 0) {
        draw(node, people.filter(function(person) {
          if (filter && person.taskGroup !== filter) {
            return false;
          } else {
            return true;
          }
        }), options);
      }
    }
  };

  var parse = function() {
    // Tasks
    var colors = d3.scale.category20();

    // For d3
    var dateFormat = d3.time.format("%Y-%m-%d");

    d3.selectAll("div.roadmap").each(function() {
      var currentTask = {};

      var lines = (this.textContent || this.innerHTML || "").split("\n");
      for (var j = 0, line; line = lines[j], j < lines.length; j++) {
        var texts;
        line = line.replace(/^\s+|\s+$/g, "");

        // 1st line, project name followed by task name
        if (!currentTask.name && !currentTask.group) {
          texts = line.split(",");
          currentTask.type = "task";
          currentTask.group = texts[0].trim();
          currentTask.name = texts.slice(-1).join(",").trim();
          currentTask.style = currentTask.group.match(/^\*/) ? "bold" : "normal";
          currentTask.group = currentTask.group.replace(/^\*\s+/, "");
          currentTask.color = colors(currentTask.group);
          continue;
        }

        // 2nd line, dates from and to
        if (!currentTask.from && !currentTask.to) {
          texts = line.replace(/[^0-9\-\/]+/, " ").split(" ");
          currentTask.from = dateFormat.parse(texts[0]);
          currentTask.to = dateFormat.parse(texts[1]);
          currentTask.to.setHours(currentTask.to.getHours() + 24); // Set the end of the day
          continue;
        }

        // next lines, people
        if (line !== "") {
          var matches, involvement;
          matches = line.match(/\s+(\d+)%\s*$/);

          if (matches) {
            involvement = parseInt(matches[1], 10);
            line = line.substring(0, line.length - matches[0].length).trim();
          } else {
            involvement = 100;
          }

          people.push({
            type: "people",
            group: line,
            from: currentTask.from,
            to: currentTask.to,
            name: currentTask.group + " — " + currentTask.name,
            taskGroup: currentTask.group,
            color: colors(currentTask.group),
            involvement: involvement
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

      node = this;
      refresh();
    });

  };

  var draw = function(node, items, options) {

    // Drawing
    var barHeight = 20;
    var gap = barHeight + 4;
    var topPadding = 20 + (options.topPadding || 0);

    // Init width and height
    var h = items.length * gap + 40;
    var w = node.clientWidth;

    // Init d3
    var svg = options.svg || d3.select(node).append("svg").attr("width", w).attr("style", "overflow: visible");

    svg.attr("height", function() {
      return parseInt(svg.attr("height") || 0, 10) + h;
    });

    // Sort items
    items.sort(function(a, b) {
      if (a.group === b.group) {
        return a.from > b.from ? 1 : -1;
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
          if (items[j].group === items[i].group) {
            count++;
          }
          j++;
        }
        groups.push({
          type: "group",
          name: items[i].group,
          count: count,
          previous: total,
          style: items[i].style
        });
        total += count;
      }
    }

    // Patterns
    var patterns = 0;

    for (i = 0; i < items.length; i++) {
      if (items[i].type === "people" && items[i].involvement !== 100) {
        svg.append("defs")
          .append("pattern")
            .attr({ id: "pattern" + patterns, width:"8", height:"8", patternUnits:"userSpaceOnUse", patternTransform:"rotate(45)"})
          .append("rect")
            .attr({ width: Math.ceil(items[i].involvement * 8 / 100), height:"8",
              transform:"translate(0,0)", fill: items[i].color, "fill-opacity": 0.8});
        items[i].pattern = "url(#pattern" + patterns + ")";
        patterns++;
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
      .attr("y", function(d){
        return d.previous * gap + topPadding;
      })
      .attr("width", function(){
        return w;
      })
      .attr("height", function(d) {
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
      .attr("y", function(d){
        return d.count * gap / 2 + d.previous * gap + topPadding + 2;
      })
      .attr("font-size", 11)
      .attr("font-weight", function(d) {
        return d.style;
      })
      .attr("text-anchor", "start")
      .attr("text-height", 14)
      .attr("fill", "#000");

    var sidePadding = options.sidePadding || axisText[0].parentNode.getBBox().width + 15;

    // Init time scale
    var timeScale = d3.time.scale()
      .clamp(true)
      .domain([
        d3.min(items, function(d) {
          return d.from;
        }),
        d3.max(items, function(d) {
          return d.to;
        })
      ]).range([0, w - sidePadding - 15]);

    // Init X Axis
    var xAxis = d3.svg.axis()
      .scale(timeScale)
      .orient("bottom")
      .ticks(d3.time.monday)
      .tickSize(- svg.attr("height") + topPadding + 20, 0, 0)
      .tickFormat(d3.time.format("%b %d"));

    // Draw vertical grid
    var xAxisGroup = svg.append("g")
      .attr("transform", "translate(" + sidePadding + ", " + (svg.attr("height") - 20) + ")")
      .call(xAxis);

    // Now
    var now = new Date();
    if (now > timeScale.domain()[0] && now < timeScale.domain()[1]) {
      xAxisGroup
        .append("line")
        .attr("x1", timeScale(now))
        .attr("y1", 0)
        .attr("x2", timeScale(now))
        .attr("y2", -svg.attr("height") + topPadding + 20)
        .attr("class", "now");

      xAxisGroup.selectAll(".now")
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

    xAxisGroup.selectAll(".tick line")
      .attr("stroke", "#dddddd")
      .attr("shape-rendering", "crispEdges");

    // Items group
    var rectangles = svg.append("g")
      .attr("transform", "translate(" + sidePadding + ", 0)")
      .selectAll("rect")
      .data(items)
      .enter();

    // Draw items boxes
    rectangles.append("rect")
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("x", function(d){
        return timeScale(d.from);
      })
      .attr("y", function(d, i){
        return i * gap + topPadding;
      })
      .attr("width", function(d){
        return timeScale(d.to) - timeScale(d.from);
      })
      .attr("height", barHeight)
      .attr("stroke", "none")
      .attr("fill", function(d) {
        return d.pattern || d.color;
      })
      .attr("fill-opacity", 0.5)
      .on("mouseover", function() {
        d3.select(this).style({cursor:"pointer"});
      })
      .on("click", selectOneGroup);

    // Draw items texts
    rectangles.append("text")
      .text(function(d){
        return d.name;
      })
      .attr("x", function(d){
        return timeScale(d.from) + (timeScale(d.to) - timeScale(d.from)) / 2;
      })
      .attr("y", function(d, i){
        return i * gap + 14 + topPadding;
      })
      .attr("font-size", 11)
      .attr("font-weight", function(d) {
        return d.style;
      })
      .attr("text-anchor", "middle")
      .attr("text-height", barHeight)
      .attr("fill", "#000")
      .style("pointer-events", "none");

    // Draw vertical mouse helper
    if (options.svg) {
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
        .attr("height", barHeight)
        .attr("stroke", "none")
        .attr("fill", "black")
        .attr("fill-opacity", 0.8)
        .style("display", "none");

      var verticalMouseText = svg.append("text")
        .attr("font-size", 11)
        .attr("font-weight", "bold")
        .attr("text-anchor", "middle")
        .attr("text-height", barHeight)
        .attr("fill", "white")
        .style("display", "none");

      var verticalMouseTopPadding = 40;

      svg.on("mousemove", function () {
        var xCoord = d3.mouse(this)[0],
          yCoord = d3.mouse(this)[1];

        if (xCoord > sidePadding) {
          verticalMouse
              .attr("x1", xCoord)
              .attr("y1", 10)
              .attr("x2", xCoord)
              .attr("y2", svg.attr("height") - 20)
              .style("display", "block");

          verticalMouseBox
              .attr("x", xCoord - 25)
              .attr("y", yCoord - (barHeight + 8) / 2 + verticalMouseTopPadding)
              .style("display", "block");

          verticalMouseText
              .attr("transform", "translate(" + xCoord + "," + (yCoord + verticalMouseTopPadding) + ")")
              .text(d3.time.format("%b %d")(timeScale.invert(xCoord - sidePadding)))
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
    }

    // options for the 2nd drawing
    return {
      sidePadding: sidePadding,
      topPadding: h,
      svg: svg
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
    refresh(getGroupName(d), this.getBBox().y);
  }

  document.addEventListener("DOMContentLoaded", function(){
    if(typeof window.Roadmap === "undefined") {
      parse();
    }
    window.Roadmap = {
      parse: parse,
      refresh: refresh
    };
  });

})();
