//globale Variablen
var schadstoff;
var heightDatenLegende;

//Visualisierungsfunktion
var vis = function (data) {
  var POLLUTANTS = ['no2', 'o3', 'pm2_5'];
  var textPollutant = (function () {
    var mapping = {
      all: 'All',
      no2: 'NO2',
      o3: 'O3',
      pm2_5: 'PM2.5'
    };

    return function (codename) {
      return mapping[codename];
    };
  })();
  var htmlPollutant = (function () {
    var mapping = {
      all: 'Alle Schadstoffe',
      no2: 'NO<sub>2</sub>',
      o3: 'O<sub>3</sub>',
      pm2_5: 'PM<sub>2.5</sub>'
    };
    return function (codename) {
      return mapping[codename];
    };
  })();
  var getPollutants = function (d) {
    var ret = [];
    var len = POLLUTANTS.length;
    for (var i = 0; i < len; i++) {
      if (d[POLLUTANTS[i]] != 'NULL') {
        ret.push(d[POLLUTANTS[i]]);
      }
    }
    return ret;
  };

  var colors = {
    greys: colorbrewer.Greys[9],
    all: colorbrewer.Blues[9],
    no2: colorbrewer.Greens[9],
    o3: colorbrewer.Purples[9],
    pm2_5: colorbrewer.Reds[9],
  };

  //Daten vorbereiten
  var data = (function () {
    data.byStation = d3.nest().key(function (d) {
      return d.place;
    }).entries(data.values);

    data.byStation.forEach(function (station) {
      //Berechne Durchschnitt für jeden Zeitpunkt
      station.values.forEach(function (d) {
        d.value = d3.mean(getPollutants(d));
      });

      //Aufteilung nach Schadstoff
      var brokenUp = [];
      station.values.forEach(function (v) {
        POLLUTANTS.forEach(function (pollutant) {
          if (v[pollutant] !== 'NULL') {
            brokenUp.push({
              place: v.place,
              time: v.time,
              hour: v.time.match(/ \d+/)[0].substr(1),
              pollutant: pollutant,
              value: v[pollutant]
            });
          }
        });
      });

      //Gruppieren nach Schadstoff
      station.byPollutant = d3.nest().key(function (d) {
        return d.pollutant;
      }).entries(brokenUp);

      //Für jeden Schadstoff, gruppieren nach Stunde
      station.byPollutant.forEach(function (pollutant) {
        var byHour = d3.nest().key(function (d) {
          return d.hour;
        }).entries(pollutant.values);
        pollutant.byHour = [];
        byHour.forEach(function (hour) {
          pollutant.byHour.push({
            place: station.key,
            hour: hour.key,
            pollutant: pollutant.key,
            value: d3.mean(hour.values, function (d) {
              return d.value;

            })
          });
        });
      });

      //Werte umwandeln in Kreisgrösse
      var variabl2 = station.values[0].o3;
      var kbi2;
      switch (true) {
        case (variabl2 > 240):
          kbi2 = 17;
          break;
        case (variabl2 > 180):
          kbi2 = 15;
          break;
        case (variabl2 > 135):
          kbi2 = 13;
          break;
        case (variabl2 > 120):
          kbi2 = 11;
          break;
        case (variabl2 > 60):
          kbi2 = 9;
          break;
        case (variabl2 > 0):
          kbi2 = 7;
          break;
      };
      station.o3 = kbi2;

      var summe = 0;
      for (let i = 0; i < 24; i++) {
        summe += station.values[i].no2;
      }
      switch (true) {
        case (summe / 24 > 160):
          kbi2 = 17;
          break;
        case (summe / 24 > 120):
          kbi2 = 15;
          break;
        case (summe / 24 > 90):
          kbi2 = 13;
          break;
        case (summe / 24 > 80):
          kbi2 = 11;
          break;
        case (summe / 24 > 40):
          kbi2 = 9;
          break;
        case (summe / 24 > 0):
          kbi2 = 7;
          break;
      };
      station.no2 = kbi2;

      summe = 0;
      for (let i = 0; i < 24; i++) {
        summe += station.values[i].pm2_5;
      }
      switch (true) {
        case (summe / 24 > 66):
          kbi2 = 17;
          break;
        case (summe / 24 > 50):
          kbi2 = 15;
          break;
        case (summe / 24 > 37):
          kbi2 = 13;
          break;
        case (summe / 24 > 33):
          kbi2 = 11;
          break;
        case (summe / 24 > 16):
          kbi2 = 9;
          break;
        case (summe / 24 > 0):
          kbi2 = 7;
          break;
      };
      station.pm2_5 = kbi2;

      station.value = Math.max(station.o3, station.no2, station.pm2_5);
    });

    //Werte in KBI-Index umwandeln
    for (let i = 0; i < 6; i++) {
      data.locations[i].o3 = umwandeln(data.byStation[i].o3);
      data.locations[i].pm2_5 = umwandeln(data.byStation[i].pm2_5);
      data.locations[i].no2 = umwandeln(data.byStation[i].no2);
      data.locations[i].value = umwandeln(data.byStation[i].value);
    }

    //Berechne OVERALL
    data.overall = (function () {
      var overall = {};

      var flattenByHour = [];
      data.byStation.forEach(function (station) {
        station.byPollutant.forEach(function (pollutant) {
          pollutant.byHour.forEach(function (hour) {
            flattenByHour.push({
              hour: hour.hour,
              pollutant: hour.pollutant,
              value: hour.value
            });
          });
        });
      });

      //nach Schadstoff gruppieren
      overall.byPollutant = d3.nest().key(function (d) {
        return d.pollutant;
      }).entries(flattenByHour);

      //für jeden Schadstoff nach Stunde gruppieren
      overall.byPollutant.forEach(function (pollutant) {
        var byHour = d3.nest().key(function (d) {
          return d.hour;
        }).entries(pollutant.values);
        pollutant.byHour = [];
        byHour.forEach(function (hour) {
          pollutant.byHour.push({
            hour: hour.key,
            pollutant: pollutant.key,
            value: d3.mean(hour.values, function (d) {
              return d.value;
            })
          });
        });
      });

      //Berechne jede Station für alle Zeitpunkte
      overall.byTime = d3.nest().key(function (d) {
        return d.time;
      }).entries(data.values);

      var x = (overall.byTime[0].key.match(/\/\d+\//)[0].substr(1, 2));
      var laufV = 1;
      // calculate mean for each time stamp
      overall.byTime.forEach(function (time) {
        time.time = time.key;
        var d = time.key.match(/\/\d+\//)[0].substr(1, 2);
        if (d === x) {
          time.heatmap = laufV;
        } else {
          laufV = laufV + 1;
          time.heatmap = laufV;
          x = d;
        }

        POLLUTANTS.forEach(function (pollutant) {
          time[pollutant] = nachKBI(d3.mean(time.values, function (d) {
            return d[pollutant];
          }), pollutant);
        });
        time.value = Math.max(time.no2, time.o3, time.pm2_5);
      });

      return overall;
    })();

    data.MAX = d3.max(data.values, function (d) {
      return d3.max(getPollutants(d));
    });

    return data;
  })();

  var controller = (function () {
    var controller = {};

    // Statusmöglichkeiten
    // keys:
    // * scope: 'all' or 'station'
    // * id: station id, valid if scope == 'station'
    // * pollutant: 'all', oder ein Schadstoffname
    var state;

    var applyOpt = function (opt) {
      (opt.scope !== undefined) && (state.scope = opt.scope);
      (opt.id !== undefined) && (state.id = opt.id);
      (opt.pollutant !== undefined) && (state.pollutant = opt.pollutant);

      ixHinter.stop();
    };

    var render = function () {
      schadstoff = state;
      map.plot(state);
      radial.plot(state);
      tiles.plot(state);
      pollutantSelector.render(state);
    };

    controller.init = function () {
      state = {
        scope: 'all',
        pollutant: 'all'
      };
      d3.select('#station-name').html('Alle Messstationen <br> in Basel');
      d3.select('body').attr('class', 'pollutant-all');
      render();
      ixHinter.start();
    };

    controller.deselectStation = function () {
      d3.select('#station-name').html('Alle Messstationen  <br/> in Basel');
      applyOpt({
        scope: 'all'
      });
      render();
    };

    controller.selectStation = function (id, name) {
      d3.select('#station-name').html(name);
      applyOpt({
        scope: 'station',
        id: id
      })
      render();
    };

    controller.deselectPollutant = function () {
      d3.select('body').attr('class', 'pollutant-all');

      applyOpt({
        pollutant: 'all'
      });
      render();
    }

    controller.selectPollutant = function (pollutant) {
      d3.select('body').attr('class', 'pollutant-' + pollutant);

      applyOpt({
        pollutant: pollutant
      });
      render();
    };

    return controller;
  })();

  var scaledColor = (function () {
    var scale = d3.scale.pow().exponent(.35)
      .domain([1, 7])
      .range([0, 1]);

    var quantize = d3.scale.quantize()
      .domain([0, 1]);

    return function (x, pollutant, colorRange) {
      colorRange || (colorRange = [0, 7]);
      quantize.range(colors[pollutant].slice(colorRange[0], colorRange[1]));
      return quantize(scale(x));
    };
  })();

  //plot map
  var map = (function () {
    var map = {};

    var margin = {
      top: 5,
      right: 5,
      bottom: 5,
      left: 5
    };
    var ratio = .6;
    var width = 802 * ratio;
    var height = 692 * ratio;

    var mapSVG = d3.select('svg.map')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var projection = d3.geoMercator()
      .center([7.618675231933594, 47.56378576797136])
      .scale(150000)
      .translate([width / 2, height / 2])

    var basel = { "type": "FeatureCollection", "features": [{ "type": "Feature", "properties": {}, "geometry": { "type": "Polygon", "coordinates": [[[7.587175369262694, 47.54183104765777], [7.585372924804687, 47.53887601640358], [7.586917877197266, 47.53725357547941], [7.582454681396485, 47.53227005016189], [7.585716247558594, 47.52960424917962], [7.58932113647461, 47.52786561031844], [7.590694427490234, 47.51940341175792], [7.5951576232910165, 47.51940341175792], [7.618160247802734, 47.540846055746044], [7.622623443603516, 47.53910778958013], [7.622623443603516, 47.55046342013974], [7.617816925048828, 47.55451840632339], [7.617301940917968, 47.558225547689226], [7.627429962158203, 47.56146908123592], [7.634124755859376, 47.5610057315948], [7.635841369628905, 47.56378576797136], [7.6403045654296875, 47.56123740692762], [7.643737792968749, 47.561584918005885], [7.647857666015625, 47.55984733956309], [7.664165496826171, 47.56540738772852], [7.664508819580078, 47.56482824357802], [7.671203613281251, 47.56563904359584], [7.672576904296875, 47.56529155941064], [7.672233581542969, 47.56355410390806], [7.677211761474609, 47.56355410390806], [7.677040100097657, 47.564944072920376], [7.675151824951172, 47.56540738772852], [7.679786682128905, 47.569577036593756], [7.683391571044922, 47.570851029762075], [7.683391571044922, 47.5686504766426], [7.6857948303222665, 47.5650599020066], [7.689914703369141, 47.571082661554044], [7.683906555175781, 47.57351473351715], [7.683906555175781, 47.576757320438766], [7.682018280029297, 47.57733633268815], [7.681159973144531, 47.58243136439364], [7.672061920166015, 47.58509447908866], [7.671890258789062, 47.58717856130287], [7.677211761474609, 47.59123070584851], [7.6842498779296875, 47.596440144994986], [7.690429687499999, 47.597597727711346], [7.692489624023437, 47.598523775445464], [7.6938629150390625, 47.60095457276624], [7.6897430419921875, 47.59875528481801], [7.683391571044922, 47.59875528481801], [7.680816650390624, 47.597713484574456], [7.675666809082031, 47.59215686626635], [7.667598724365234, 47.59180955803043], [7.645797729492187, 47.59701893955438], [7.641677856445312, 47.59435643156871], [7.64270782470703, 47.59157801792598], [7.618932723999023, 47.57704682736381], [7.604942321777345, 47.57768373696443], [7.604084014892578, 47.58138923915503], [7.60477066040039, 47.58492080182527], [7.588977813720702, 47.5902466424454], [7.585115432739257, 47.58225767829449], [7.584772109985352, 47.575309761802785], [7.579364776611327, 47.57687312340086], [7.575416564941405, 47.57606249728773], [7.566490173339844, 47.57779953787762], [7.565717697143554, 47.576352008054506], [7.556791305541991, 47.572472430791876], [7.556276321411133, 47.57154592206455], [7.5592803955078125, 47.569461217496276], [7.557306289672852, 47.5650599020066], [7.554903030395507, 47.564364923647425], [7.5646018981933585, 47.557067094186735], [7.561426162719727, 47.55173787817854], [7.55859375, 47.55237509557584], [7.555847167968749, 47.54443828985946], [7.564773559570312, 47.54565495851057], [7.581510543823243, 47.5438009759625], [7.587175369262694, 47.54183104765777]]] } }] };
    var rhein = { "type": "FeatureCollection", "features": [{ "type": "Feature", "properties": {}, "geometry": { "type": "Point", "coordinates": [2, 47] } }, { "type": "Feature", "properties": {}, "geometry": { "type": "LineString", "coordinates": [[7.583141326904296, 47.60894068308017], [7.587261199951171, 47.606394519436975], [7.589149475097655, 47.604195460179945], [7.591381072998047, 47.60060732292067], [7.591552734375, 47.59748197059214], [7.590694427490234, 47.59447219560258], [7.587347030639649, 47.589494110887394], [7.584514617919922, 47.58454449911106], [7.583312988281249, 47.58124449789785], [7.5829267501831055, 47.57577298492025], [7.5836992263793945, 47.57348578094381], [7.5836992263793945, 47.5717485972493], [7.583398818969726, 47.56940330785151], [7.583184242248534, 47.567144781761506], [7.583656311035156, 47.56529155941064], [7.5844717025756845, 47.56378576797136], [7.586359977722169, 47.56170075451973], [7.588634490966797, 47.559702538758216], [7.592411041259766, 47.55712501747015], [7.595844268798827, 47.555561066342044], [7.599191665649414, 47.55515558991116], [7.602238655090332, 47.55515558991116], [7.606358528137207, 47.55544521625339], [7.608633041381835, 47.55582172810505], [7.613611221313476, 47.55700917083927], [7.616186141967773, 47.5577911306273], [7.618417739868163, 47.557993859037765], [7.6210784912109375, 47.55819658666383], [7.624340057373046, 47.5581676256224], [7.627558708190918, 47.55842827441883], [7.628803253173828, 47.55871788267187], [7.630519866943359, 47.558920607496525], [7.632837295532226, 47.55886268619808], [7.634854316711425, 47.558804764835614], [7.637343406677246, 47.55813866456498], [7.6386308670043945, 47.55750151725169], [7.639703750610351, 47.556806438618885], [7.641119956970215, 47.55486596196815], [7.643008232116699, 47.55304126911598], [7.6448965072631845, 47.5510427230903], [7.646613121032714, 47.548899270188315], [7.649102210998535, 47.54733507355602], [7.6506900787353525, 47.546350185060895], [7.652277946472168, 47.546060508452214], [7.653779983520508, 47.54568392646759], [7.655410766601562, 47.54548115043221], [7.656869888305664, 47.54530734177753], [7.65820026397705, 47.54507559600815], [7.6598310470581055, 47.54440932121404], [7.660560607910156, 47.54377200696491], [7.66120433807373, 47.5425842642798], [7.66171932220459, 47.541512375829114], [7.662234306335448, 47.540701202433446], [7.662749290466309, 47.53960030417842], [7.663264274597167, 47.53823863488505], [7.663822174072266, 47.53745638334048], [7.666568756103516, 47.53855732661285], [7.66519546508789, 47.54020869817697], [7.6647233963012695, 47.54128061328248], [7.6642513275146475, 47.54243941576989], [7.663822174072266, 47.54336643931762], [7.663135528564452, 47.544525195699606], [7.6625776290893555, 47.54548115043221], [7.661762237548828, 47.5458577338736], [7.660818099975586, 47.54640812019053], [7.659873962402344, 47.546581925195255], [7.658243179321288, 47.5468426316217], [7.656354904174804, 47.546987467964996], [7.653479576110839, 47.54747990853858], [7.651548385620116, 47.548088211094985], [7.649788856506348, 47.54892823635237], [7.648415565490722, 47.55023169716656], [7.647042274475098, 47.5520564878457], [7.644639015197753, 47.55506870169635], [7.641892433166503, 47.55819658666383], [7.640776634216308, 47.55921021302821], [7.6361846923828125, 47.56144012200342], [7.634382247924805, 47.562019303612146], [7.63249397277832, 47.56227993324703], [7.629661560058594, 47.562569520209514], [7.627944946289062, 47.5626274374099], [7.626614570617676, 47.56248264428884], [7.624683380126953, 47.56193242677904], [7.623224258422851, 47.56144012200342], [7.622108459472655, 47.56109260996465], [7.618803977966309, 47.56010798000333], [7.616443634033202, 47.559470856638036], [7.612967491149902, 47.55897852873093], [7.608675956726073, 47.55819658666383], [7.604084014892578, 47.557211902275256], [7.600736618041991, 47.55689332395224], [7.5971317291259775, 47.55698020914153], [7.5958871841430655, 47.557356709963564], [7.5951147079467765, 47.55776216936179], [7.594084739685058, 47.55834139163078], [7.593398094177246, 47.55886268619808], [7.592453956604004, 47.55935501519375], [7.591853141784668, 47.55987629967602], [7.590909004211425, 47.560455498573305], [7.5900936126708975, 47.56123740692762], [7.588934898376464, 47.562569520209514], [7.588076591491698, 47.56364097805187], [7.5867462158203125, 47.56552321579023], [7.586359977722169, 47.56691313255338], [7.58580207824707, 47.56986658321691], [7.5864458084106445, 47.57090893780611], [7.586531639099121, 47.57258824323027], [7.586231231689452, 47.57554137387374], [7.585716247558594, 47.57797323876721], [7.585973739624023, 47.58028919556413], [7.586488723754883, 47.58156292813543], [7.586874961853027, 47.58312610302782], [7.587347030639649, 47.58454449911106], [7.588977813720702, 47.587873236934634], [7.590222358703612, 47.589841434489465], [7.591853141784668, 47.59189638530548], [7.592968940734862, 47.59450113657103], [7.594084739685058, 47.596324385314794], [7.594428062438965, 47.597626666951136], [7.594599723815918, 47.599912816315054], [7.594213485717774, 47.602430358896314], [7.593097686767577, 47.60436907348248], [7.5920677185058585, 47.606220912856834], [7.590651512145996, 47.60749401439728], [7.589063644409179, 47.609143213502655], [7.585930824279785, 47.61090808827486]] } }] };

    //Zeichne Map
    mapSVG.append("g")
      .selectAll("path")
      .data(basel.features)
      .enter()
      .append("path")
      .attr("fill", "grey")
      .attr("d", d3.geoPath()
        .projection(projection)
      )
      .style("stroke", "none")

    mapSVG.append("g")
      .selectAll("path")
      .data(rhein.features)
      .enter()
      .append("path")
      .attr("fill", "blue")
      .attr("d", d3.geoPath()
        .projection(projection)
      )
      .style("stroke", "none")

    var radiusRange = [1, 15];
    var radius = {
      all: d3.scale.linear()
        .domain([0, d3.max(data.byStation, function (d) {
          return d.value;
        })])
        .range(radiusRange)
    };
    POLLUTANTS.forEach(function (pollutant) {
      radius[pollutant] = d3.scale.linear()
        .domain([0, d3.max(data.byStation, function (d) {
          return d[pollutant];
        })])
        .range(radiusRange);
    });

    var elem = mapSVG.selectAll('.location')
      .data(data.locations)

    var elemEnter = elem.enter()
      .append("g")
      .attr("transform", function (d) { return "translate(" + (d.x / 2) + "," + (d.y / 2) })

    var circle = elemEnter.append("circle")
      .attr('class', 'location')
      .attr('cx', function (d) {
        return d.x * ratio;
      })
      .attr('cy', function (d) {
        return d.y * ratio;
      })
      .on('click', function (d) {
        controller.selectStation(d.id, d.eng_name + '<br />' + d.full_name);
        d3.event.stopPropagation();
      });

    elemEnter.append("text")
      .attr('class', 'extra')

      .attr("dx", function (d) {
        return d.x * ratio - 3;
      })
      .attr("dy", function (d) {
        return d.y * ratio + 3;
      })

      .on('click', function (d) {
        controller.selectStation(d.id, d.eng_name + '<br />' + d.full_name);
        d3.event.stopPropagation();
      });

    mapSVG.on('click', function () {
      controller.deselectStation();
    });


    //Legende
    (function () {
      var dy = 18;

      var mapLegend = d3.select('svg.map')
        .append('g')
        .attr('class', 'legend')
        .attr('transform', 'translate(15, 20)');
      var legendData = [
        {
          value: 17,
          desc: '6: sehr hoch'
        },
        {
          value: 15,
          desc: '5: hoch'
        },
        {
          value: 13,
          desc: '4: erheblich'
        },
        {
          value: 11,
          desc: '3: deutlich'
        },
        {
          value: 9,
          desc: '2: mässig'
        },
        {
          value: 7,
          desc: '1: gering'
        }
      ];
      mapLegend.selectAll('circle.legend-element')
        .data(legendData)
        .enter().append('circle')
        .attr('class', 'legend-element')
        .attr('cx', 5)
        .attr('cy', function (d, i) {
          return i * dy;
        })
        .attr('r', function (d) {
          return d.value;
        });
      mapLegend.selectAll('text.legend-element')
        .data(legendData)
        .enter().append('text')
        .attr('class', 'legend-element')
        .attr('x', 25)
        .attr('y', function (d, i) {
          return i * dy;
        })
        .attr('dy', '.375em')
        .text(function (d) {
          return d.desc;
        });
      heightDatenLegende = height - 70
      let datumZeit = data.values[0].time.split(" ");
      let datumDate = datumZeit[0].split("/");
      mapLegend.append('text')
        .attr('class', 'legend-element axis-scale')
        .attr('x', width - 20)
        .attr('y', heightDatenLegende)
        .attr('text-anchor', 'end')
        .text(datumDate[1] + '.' + datumDate[0] + '.' + datumDate[2] + ' ' + datumZeit[1])

    })();

    map.plot = function (opt) {
      var pollutantKey = opt.pollutant;
      (pollutantKey === 'all') && (pollutantKey = 'value')

      //Map färben
      mapSVG.selectAll('.map')
        .classed('active', function () {
          return (opt.scope === 'all');
        })
        .transition()
        .style('fill', function () {
          return colors[opt.pollutant][1];
        })
        .style('stroke', function () {
          return colors[opt.pollutant][8];
        });

      //Update locations
      mapSVG.selectAll('.location')
        .classed('active', function (d) {
          return (opt.scope === 'station' && opt.id === d.id);
        })
        .transition()
        .attr('r', function (d) {
          var len = data.byStation.length;
          for (var i = 0; i < len; i++) {
            if (data.byStation[i].key === d.id) {
              return data.byStation[i][pollutantKey];
            }
          }
        })
        .style('fill', function (d) {
          var len = data.byStation.length;
          for (var i = 0; i < len; i++) {
            if (data.byStation[i].key === d.id) {
              return scaledColor(data.byStation[i][pollutantKey], opt.pollutant, [4, 9]);
            }
          }
        })
        .style('stroke', function (d) {
          return colors[opt.pollutant][8];
        });

      mapSVG.selectAll('.extra')
        .text(function (d) {
          return d[pollutantKey];
        });


      // Radial Einfärben und Beschriftung ändern
      switch (pollutantKey) {
        case 'value':
          d3.select('#station-name2').text('Kurzzeit-Belastungs-Index KBI');
          document.getElementById("radialLegend1").style.fill = "#737373";
          document.getElementById("radialLegend2").style.fill = "#737373";
          document.getElementById("radialLegend3").style.fill = "#737373";
          document.getElementById("halbkreis0").style.stroke = "#737373";
          document.getElementById("halbkreis1").style.stroke = "#737373";
          document.getElementById("halbkreis2").style.stroke = "#737373";
          document.getElementById("halbkreis3").style.stroke = "#737373";
          break;
        case 'no2':
          d3.select('#station-name2').text('Stickstoffdioxid-Belastungs-Index');
          document.getElementById("radialLegend3").style.fill = "rgb(116, 196, 118)";
          document.getElementById("radialLegend2").style.fill = "#737373";
          document.getElementById("radialLegend1").style.fill = "#737373";
          document.getElementById("halbkreis2").style.stroke = "rgb(116, 196, 118)";
          document.getElementById("halbkreis3").style.stroke = "rgb(116, 196, 118)";
          document.getElementById("halbkreis0").style.stroke = "#737373";
          document.getElementById("halbkreis1").style.stroke = "#737373";
          break;
        case 'o3':
          d3.select('#station-name2').text('Ozon-Belastungs-Index');
          document.getElementById("radialLegend1").style.fill = "#737373";
          document.getElementById("radialLegend2").style.fill = "rgb(158, 154, 200)";
          document.getElementById("radialLegend3").style.fill = "#737373";
          document.getElementById("halbkreis0").style.stroke = "#737373";
          document.getElementById("halbkreis1").style.stroke = "rgb(158, 154, 200)";
          document.getElementById("halbkreis2").style.stroke = "rgb(158, 154, 200)";
          document.getElementById("halbkreis3").style.stroke = "#737373";
          break;
        case 'pm2_5':
          d3.select('#station-name2').text('Feinstaub-Belastungs-Index');
          document.getElementById("radialLegend3").style.fill = "#737373";
          document.getElementById("radialLegend2").style.fill = "#737373";
          document.getElementById("radialLegend1").style.fill = "rgb(251, 106, 74)";
          document.getElementById("halbkreis2").style.stroke = "#737373";
          document.getElementById("halbkreis3").style.stroke = "#737373";
          document.getElementById("halbkreis0").style.stroke = "rgb(251, 106, 74)";
          document.getElementById("halbkreis1").style.stroke = "rgb(251, 106, 74)";
          break;
      }
    };

    return map;
  })();

  //Radial zeichnen
  var radial = (function () {
    var radial = {};

    var stack = d3.layout.stack()
      .values(function (d) {
        return d.byHour;
      })
      .x(function (d) {
        return d.hour;
      })
      .y(function (d) {
        return d.value;
      });

    var layeredOverall = stack(data.overall.byPollutant);
    var layeredStations = [];
    data.byStation.forEach(function (station) {
      layeredStations.push(stack(station.byPollutant));
    });

    var width = 418;
    var height = 425;
    var radialSVG = d3.select('svg.radial')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', 'translate(' + (width / 2) + ',' + (height / 2 + 5) + ')');

    var outerRadius = width / 2;
    var innerRadius = 45;

    var angle = d3.scale.linear()
      .domain([0, 24])
      .range([0, 2 * Math.PI]);
    var radius = d3.scale.linear()
      .domain([0, d3.max(data.byStation, function (station) {
        return d3.max(station.byPollutant, function (pollutant) {
          return d3.max(pollutant.byHour, function (hour) {
            return hour.y0 + hour.y;
          });
        });
      })])
      .range([innerRadius, outerRadius]);

    var area = d3.svg.area.radial()
      .interpolate('cardinal-closed')
      .angle(function (d) {
        return angle(d.hour);
      })
      .innerRadius(function (d) {
        return radius(d.y0);
      })
      .outerRadius(function (d) {
        return radius(d.y0 + d.y);
      });

    // create an allZero data for smooth ease-in
    var allZero = [];
    POLLUTANTS.forEach(function (pollutant) {
      allZero.push({
        key: pollutant,
        byHour: (function () {
          var ret = [];
          for (var i = 0; i < 24; i++) {
            ret.push({
              hour: i,
              pollutant: pollutant,
              value: 0,
              y0: 0,
              y: 0
            })
          }
          return ret;
        })()
      });
    });

    radialSVG.selectAll('.layer')
      .data(allZero)
      .enter().append('path')
      .attr('class', 'layer')
      .attr('d', function (d) {
        return area(d.byHour);
      })
      .on('click', function (d) {
        controller.selectPollutant(d.key);
      });

    //Zeichne Zeitachse
    (function () {
      var radialTimeScale = d3.select('svg.radial')
        .append('g')
        .attr('class', 'legend time-scale');
      var textClass = 'legend-element time-scale';
      radialTimeScale
        .append('text')
        .attr('class', textClass)
        .text('0:00')
        .attr('x', width / 2)
        .attr('y', height / 2 - 20)
        .attr('dy', '.375em')
        .attr('text-anchor', 'middle');
      radialTimeScale
        .append('text')
        .attr('class', textClass)
        .text('6:00')
        .attr('x', width / 2 + 25)
        .attr('y', height / 2 + 5)
        .attr('dy', '.375em')
        .attr('text-anchor', 'middle');
      radialTimeScale
        .append('text')
        .attr('class', textClass)
        .text('12:00')
        .attr('x', width / 2)
        .attr('y', height / 2 + 30)
        .attr('dy', '.375em')
        .attr('text-anchor', 'middle');
      radialTimeScale
        .append('text')
        .attr('class', textClass)
        .text('18:00')
        .attr('x', width / 2 - 25)
        .attr('y', height / 2 + 5)
        .attr('dy', '.375em')
        .attr('text-anchor', 'middle');
    })();

    //Legende
    (function () {
      var dy = 25;
      var curveWidth = 50;
      var curveHeight = 10;

      var radialLegend = d3.select('svg.radial')
        .append('g')
        .attr('class', 'legend')
        .attr('transform', 'translate(' + (width - curveWidth) + ',5)');
      var legendData = [''];
      var len = POLLUTANTS.length;
      for (var i = len - 1; i >= 0; i--) {
        legendData.push(POLLUTANTS[i]);
      }
      radialLegend.selectAll('path.legend-element')
        .data(legendData)
        .enter().append('path')
        .attr('class', 'legend-element')
        .attr('id', function (d, i) {
          return "halbkreis" + i;
        })
        .attr('d', function (d, i) {
          return 'M 0 ' + (curveHeight + dy * i)
            + ' q ' + curveWidth / 2 + ' -' + curveHeight + ' '
            + curveWidth + ' 0';
        });
      radialLegend.selectAll('text.legend-element')
        .data(legendData)
        .enter().append('text')
        .attr('class', 'legend-element')
        .attr('id', function (d, i) {
          return "radialLegend" + i;
        })
        .attr('x', curveWidth / 2)
        .attr('y', function (d, i) {
          return dy * i - 3;
        })
        .text(function (d) {
          return textPollutant(d);
        });

      var radialLegend2 = d3.select('svg.radial')
        .append('g')
        .attr('class', 'legend')
        .attr('transform', 'translate(' + (width - curveWidth) + ',20)');

      radialLegend2.append('text')
        .attr('class', 'legend-element axis-scale')
        .attr('x', (curveWidth / 2) - 20)
        .attr('y', heightDatenLegende)
        .attr('text-anchor', 'end')
        .text('letzte 6 Monate')

    })();

    radial.plot = function (opt) {
      switch (opt.scope) {
        case 'all':
          var layers = layeredOverall;
          break;
        case 'station':
          var len = layeredStations.length;
          for (var i = 0; i < len; i++) {
            var found = false;
            if (layeredStations[i][0].byHour[0].place == opt.id) {
              var layers = layeredStations[i];
              found = true;
              break;
            }
          }
          if (!found) {
            console.error('wrong id passed to radial.plot: ' + opt.id);
            return;
          }
          break;
      }

      radialSVG.selectAll('.layer')
        .data(layers)
        .classed('active', function (d) {
          return (opt.pollutant === d.key);
        })
        .transition()
        .attr('d', function (d) {
          return area(d.byHour);
        })
        .style('fill', function (d, i) {
          if (opt.pollutant === 'all') {

            return colors.all[4];
          } else if (opt.pollutant === d.key) {
            return colors[d.key][4];
          } else {
            return colors.greys[2];
          }
        });
    };

    return radial;
  })();

  //Heatmap
  d3.select('#station-name3').text('Monatsübersicht');
  var tiles = (function () {
    var tiles = {};

    var width = 880;
    var height = 350;
    var axisHeight = 32;
    var axisWidth = 60;
    var tilesSVG = d3.select('svg.tiles')
      .attr('width', width)
      .attr('height', height + 40)
      .append('g')
      .attr('transform', 'translate(' + axisWidth + ',' + axisHeight + ')');

    var gap = 2;
    var tileWidth = (width - axisWidth) / 24 - gap;
    var tileHeight = (height - axisHeight) / 31 - gap;


    //Tooltip
    var Tooltip = d3.select("#div_template")
      .append("div")
      .style("opacity", 0)
      .attr("class", "tooltip")
      .style("border", "solid")
      .style("border-width", "2px")
      .style("border-radius", "10px")
      .style("padding", "5px")
      .style("text-align", "center")
      .style("color", "white")
      .style("font-family", 'Helvetica Neue, Helvetica, sans-serif')
      .style("font-size", "12px")

    tilesSVG.selectAll('.tile')
      .data(data.overall.byTime.slice(0, 672))
      .enter().append('rect')
      .attr('class', 'tile')
      .attr('width', tileWidth)
      .attr('height', tileHeight)
      .attr('rx', 3)
      .attr('ry', 1)
      .attr('x', function (d, i) {

        return d.time.match(/ \d+/)[0] * (tileWidth + gap);
      })
      .attr('y', function (d, i) {

        return d.heatmap * (tileHeight + gap);
      })
      .on("mouseover", function (d) {
        Tooltip
          .style("opacity", 0.8)
        d3.select(this)
          .style("stroke", "black")
      })
      .on("mousemove", function (d) {
        Tooltip
          .html(function () {
            let datumZeit = d.time.split(" ");
            let datumDate = datumZeit[0].split("/");

            if (schadstoff.scope === 'all') {
              if (schadstoff.pollutant === 'all') {
                return datumDate[1] + "." + datumDate[0] + "." + datumDate[2] + "<br>" + datumZeit[1] + "<br>" + d.value;
              } else {
                var mittelwert = d.values[0][schadstoff.pollutant] + d.values[1][schadstoff.pollutant] + d.values[2][schadstoff.pollutant] + d.values[3][schadstoff.pollutant] + d.values[4][schadstoff.pollutant] + d.values[5][schadstoff.pollutant];
                return datumDate[1] + "." + datumDate[0] + "." + datumDate[2] + "<br>" + datumZeit[1] + "<br>" + Math.round(mittelwert / 6 * 10) / 10;
              }
            } else {
              if (schadstoff.pollutant === 'all') {
                return datumDate[1] + "." + datumDate[0] + "." + datumDate[2] + "<br>" + datumZeit[1] + "<br>" + Math.max(nachKBI(d.no2, "no2"), nachKBI(d.o3, "o3"), nachKBI(d.pm2_5, "pm2_5"));
              } else {
                return datumDate[1] + "." + datumDate[0] + "." + datumDate[2] + "<br>" + datumZeit[1] + "<br>" + d[schadstoff.pollutant];
              }
            }
          })
          .style("left", (d3.mouse(this)[0]) + "px")
          .style("top", (d3.mouse(this)[1]) + 630 + "px")
          .style("background-color", function () {
            switch (schadstoff.pollutant) {
              case 'all':
                return "rgb(66, 146, 198)";
              case 'no2':
                return "rgb(65, 171, 93)";
              case 'o3':
                return "rgb(128, 125, 186)";
              case 'pm2_5':
                return "rgb(239, 59, 44)";
            }
          })
      })
      .on("mouseleave", function (d) {
        Tooltip
          .style("opacity", 0)
        d3.select(this)
          .style("stroke", "none")
      });



    //Achsen
    (function () {
      //X-Achse
      var xAxis = d3.select('svg.tiles')
        .append('g')
        .attr('class', 'legend axis')
        .attr('transform', 'translate(' + axisWidth + ',' + (axisHeight - 3) + ')');
      var xData = [];
      for (var i = 0; i < 24; i++) {
        xData.push(i);
      }
      xAxis.selectAll('text.legend-element.axis-scale')
        .data(xData)
        .enter().append('text')
        .attr('class', 'legend-element axis-scale')
        .attr('x', function (d, i) {
          return (tileWidth + gap) * i;
        })
        .attr('y', 0)
        .text(function (d) {
          if (d % 3 === 0) {
            return d + ':00';
          }
          return '';
        });

      //Y-Achse
      var yAxis = d3.select('svg.tiles')
        .append('g')
        .attr('class', 'legend axis')
        .attr('transform', 'translate(0,' + axisHeight + ')');
      var yData = [];
      yData = ["", "1", "", "", "", "", "", "", "2", "", "", "", "", "", "", "3", "", "", "", "", "", "", "4", "", "", "", "", "", "",];
      yAxis.selectAll('text.legend-element.axis-scale')
        .data(yData)
        .enter().append('text')
        .attr('class', 'legend-element axis-scale')
        .attr('x', axisWidth - 3)
        .attr('y', function (d, i) {
          return (tileHeight + gap) * i + tileHeight / 2;
        })
        .attr('dy', '.375em')
        .attr('text-anchor', 'end')
        .text(function (d) {
          return d;
        });
      yAxis.append('text')
        .attr('class', 'legend-element axis-scale')
        .attr('x', axisWidth - 3)
        .attr('y', -3)
        .attr('text-anchor', 'end')
        .text('Woche')
    })();

    //Legende
    var tilesLegende = d3.select('svg.tiles')
      .append('g')
      .attr('transform', 'translate(' + axisWidth + ',' + axisHeight + ')');

    var legendeData = [1, 2, 3, 4, 5, 6, 7];
    tilesLegende.selectAll('.tile')
      .data(legendeData)
      .enter().append('rect')

      .attr('class', 'tile')
      .attr('width', tileWidth)
      .attr('height', tileHeight)
      .attr('rx', 3)
      .attr('ry', 1)
      .attr('x', function (d) {
        return (d + 7.5) * (tileWidth + gap);
      })
      .attr('y', height - 20)
    tilesLegende.append('text')
      .attr('class', 'legend-element axis-scale')
      .attr('x', 8.4 * (tileWidth + gap))
      .attr('y', height - 20 + (tileHeight))
      .attr('text-anchor', 'end')
      .text('gering')
    tilesLegende.append('text')
      .attr('class', 'legend-element axis-scale')
      .attr('x', 15.6 * (tileWidth + gap))
      .attr('y', height - 20 + (tileHeight))
      .attr('text-anchor', 'start')
      .text('sehr hoch')

    tiles.plot = function (opt) {
      switch (opt.scope) {
        case 'all':
          var entries = data.overall.byTime;
          tilesSVG.selectAll('.tile')
            .data(entries)
            .transition()
            .style('fill', function (d) {
              if (opt.pollutant === 'all') {
                return scaledColor(d.value, 'all');
              } else {
                return scaledColor(d[opt.pollutant], opt.pollutant);
              }
            });
          break;
        case 'station':
          var len = data.byStation.length;
          for (var i = 0; i < len; i++) {
            var found = false;
            if (data.byStation[i].key == opt.id) {
              var entries = data.byStation[i].values;
              found = true;
              tilesSVG.selectAll('.tile')
                .data(entries)
                .transition()
                .style('fill', function (d) {
                  if (opt.pollutant === 'all') {
                    return scaledColor(Math.max(nachKBI(d.no2, "no2"), nachKBI(d.o3, "o3"), nachKBI(d.pm2_5, "pm2_5")), "all");
                  } else {
                    return scaledColor(nachKBI(d[opt.pollutant], opt.pollutant), opt.pollutant);
                  }
                });
              break;
            }
          }
          if (!found) {
            console.error('wrong id passed to tiles.plot: ' + opt.id);
          }
          break;
      }

      tilesLegende.selectAll('.tile')
        .data(legendeData)
        .style('fill', function (d) {
          if (opt.pollutant === 'all') {
            return scaledColor(d, 'all');
          } else {
            return scaledColor(d, opt.pollutant);
          }
        })
    };

    return tiles;
  })();

  var pollutantSelector = (function () {
    var pollutantSelector = {};

    var options = ['all'];
    POLLUTANTS.forEach(function (pollutant) {
      options.push(pollutant);
    });
    var wrapper = d3.select('#pollutant-selector');

    wrapper.selectAll('div')
      .data(options)
      .enter().append('div')
      .attr('class', function (d) {
        return 'pollutant ' + d;
      })
      .html(function (d) {
        return htmlPollutant(d);
      })
      .style('border-color', function (d) {
        return colors[d][5];
      })
      .on('click', function (d) {
        controller.selectPollutant(d);
      });

    pollutantSelector.render = function (opt) {
      wrapper.selectAll('div')
        .classed('active', function (d) {
          return (opt.pollutant === d);
        });
    };

    return pollutantSelector;
  })();

  var ixHinter = (function () {
    var ixHinter = {};

    var to;

    ixHinter.start = function () {
      to = window.setTimeout(function () {
        show();
      }, 3000);
    };

    ixHinter.stop = function () {
      window.clearTimeout(to);
      window.setTimeout(function () {
        hide();
      }, 2000);
    };

    var show = function () {
      d3.select('#ix-hint').classed('active', true);
    };

    var hide = function () {
      d3.select('#ix-hint').classed('active', false);
    };

    return ixHinter;
  })();

  controller.init();


};

//Datumsformat ändern 
function strToDate(dtStr) {
  if (!dtStr) return null
  let dateParts = dtStr.split(".");
  let timeParts = dateParts[2].split(" ")[1].split(":");
  var stunden = parseInt(timeParts[0], 10);
  dateParts[2] = dateParts[2].split(" ")[0];
  return dateParts[1] + "/" + dateParts[0] + "/" + dateParts[2] + " " + stunden + ":" + timeParts[1]
}
function strToMin(dtStr) {
  if (!dtStr) return null
  let dateParts = dtStr.split(":");
  return dateParts[1]
}


//Daten laden
d3.csv('data/locations.csv', function (locations) {
  d3.csv('data/location-coord.csv', function (coord) {
    for (var i = 0; i < locations.length; i++) {
      var found = false;
      for (var j = 0; j < coord.length; j++) {
        if (coord[j].id === locations[i].id) {
          found = true;
          locations[i].x = coord[j].x;
          locations[i].y = coord[j].y;
          break;
        }
      }
      if (!found) {
        locations.splice(i, 1);
        i--;
      }
    }

    //A2, Feldbergstrasse und StJohann
    fetch('https://data.bs.ch/api/records/1.0/search/?dataset=100178&q=&rows=8736&sort=timestamp&facet=timestamp')
      .then(data => data.json())
      .then(success => myFunc(success));

    function myFunc(success) {

      let arrayObj = success.records.map(item => {
        if (strToMin(item.fields.anfangszeit) <= 0) {
          return {
            id: item.datasetid,
            no2: item.fields.a2hard_no2,
            o3: item.fields.a2hard_o3,
            pm2_5: item.fields.a2hard_pm25,
            place: "1",
            time: strToDate(item.fields.anfangszeit),
          };
        }
      });

      let arrayObj1 = success.records.map(item => {
        if (strToMin(item.fields.anfangszeit) <= 0) {
          return {
            id: item.datasetid,
            no2: item.fields.feldbergstr2_no2,
            o3: item.fields.feldbergstr2_o3,
            pm2_5: item.fields.feldbergstr2_pm25,
            place: "2",
            time: strToDate(item.fields.anfangszeit),
          };
        }
      });

      let arrayObj2 = success.records.map(item => {
        if (strToMin(item.fields.anfangszeit) <= 0) {
          return {
            id: item.datasetid,
            no2: item.fields.stjohann2_no2,
            o3: item.fields.stjohann2_o3,
            pm2_5: item.fields.stjohann2_pm25,
            place: "3",
            time: strToDate(item.fields.anfangszeit),
          };
        }
      });

      d3.select('#loading')
        .transition()
        .duration(3000)
        .style('opacity', 0)
        .remove();

      //Gundeldingerstrasse
      fetch('https://data.bs.ch/api/records/1.0/search/?dataset=100093&q=&rows=8736&sort=timestamp&facet=timestamp')
        .then(data => data.json())
        .then(success => myFunc2(success));


      function myFunc2(success) {

        let arrayObj3 = success.records.map(item => {
          if (strToMin(item.fields.anfangszeit) <= 0) {
            return {
              id: item.datasetid,
              no2: item.fields.g107_no2,
              o3: item.fields.g107_03,
              pm2_5: item.fields.g107_pm25,
              place: "4",
              time: strToDate(item.fields.anfangszeit),
            };
          }
        });

        let arrayObj4 = success.records.map(item => {
          if (strToMin(item.fields.anfangszeit) <= 0) {
            return {
              id: item.datasetid,
              no2: item.fields.g125_no2,
              o3: item.fields.g125_o3,
              pm2_5: item.fields.g125_pm25,
              place: "5",
              time: strToDate(item.fields.anfangszeit),
            };
          }
        });

        let arrayObj5 = success.records.map(item => {
          if (strToMin(item.fields.anfangszeit) <= 0) {
            return {
              id: item.datasetid,
              no2: item.fields.g131_no2,
              o3: item.fields.g131_o3,
              pm2_5: item.fields.g131_pm25,
              place: "6",
              time: strToDate(item.fields.anfangszeit),
            };
          }
        });

        arrayObj.push.apply(arrayObj, arrayObj1);
        arrayObj.push.apply(arrayObj, arrayObj2);
        arrayObj.push.apply(arrayObj, arrayObj3);
        arrayObj.push.apply(arrayObj, arrayObj4);
        arrayObj.push.apply(arrayObj, arrayObj5);

        const results = arrayObj.filter(element => {
          return element !== undefined;
        });

        //Visualisierung ausführen
        vis({
          values: results,
          locations: locations
        });
      }
    }
  });
});

//Funkction Kreis in KBI umwandeln
function umwandeln(wertin17) {
  switch (wertin17) {
    case 17:
      return 6;
    case 15:
      return 5;
    case 13:
      return 4;
    case 11:
      return 3;
    case 9:
      return 2;
    case 7:
      return 1;
  };

}

//Funktion Messwert in KBI umwandeln
function nachKBI(variabl2, pollut) {
  switch (pollut) {
    case "no2":
      switch (true) {
        case (variabl2 > 160):
          return 6;
        case (variabl2 > 120):
          return 5;
        case (variabl2 > 90):
          return 4;
        case (variabl2 > 80):
          return 3;
        case (variabl2 > 40):
          return 2;
        case (variabl2 > 0):
          return 1;
        case (variabl2 = 0):
          return 0;
      };

    case "o3":
      switch (true) {
        case (variabl2 > 240):
          return 6;
        case (variabl2 > 180):
          return 5;
        case (variabl2 > 135):
          return 4;
        case (variabl2 > 120):
          return 3;
        case (variabl2 > 60):
          return 2;
        case (variabl2 > 0):
          return 1;
      };

    case "pm2_5":
      switch (true) {
        case (variabl2 > 66):
          return 6;
        case (variabl2 > 50):
          return 5;
        case (variabl2 > 37):
          return 4;
        case (variabl2 > 33):
          return 3;
        case (variabl2 > 16):
          return 2;
        case (variabl2 > 0):
          return 1;
      };
  }
}