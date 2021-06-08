import { Email, Person, Title, getCorrespondants } from "../data";
import * as d3 from "d3";
import { Observable, Subject } from 'rxjs';
import { DataSetDiff, DataSet, IDSetDiff } from '../pipeline/dynamicDataSet';
import { titleRanks } from './constants';


type Node = {
  name: string,
  id: number,
  group: Title,  // used for titles in our dataset
  index?: number, // used in adjacency matrix
  count?: number, // used in adjacency matrix
  sentiment?: number, // total sentiment
}

type Edge = {
  source: number,
  target: number,
  value: number,
  sentiment: number,
  selected: boolean,
}

export class AdjacencyMatrix {
  async visualize(data: Observable<[DataSetDiff<Person>, DataSetDiff<Email>]>, selSub: Subject<[IDSetDiff, IDSetDiff]>): Promise<void> {
    // datasets that hold the data
    const persons: DataSet<Person> = {};
    const emails: DataSet<Email> = {};

    // datasets that hold IDs of selected persons and emails
    const selectedPersons: DataSet<number> = {};
    const selectedEmails: DataSet<number> = {};

    // make updates work
    data.subscribe(event => {
      // console.log(event)

      // implement the changes given by the diffs
      const personDiff = event[0];
      personDiff.apply(persons)
      const emailsDiff = event[1];
      emailsDiff.apply(emails);

      // get arrays from dataset objects
      const personList = Object.values(persons);
      const emailList = Object.values(emails);
      const selectedPersonIDs = Object.values(selectedPersons).map(i => Number(i));
      const selectedEmailIDs = Object.values(selectedEmails).map(i => Number(i));

      updateAM(personList, emailList, selectedPersonIDs, selectedEmailIDs);
    });

    // make selections works
    selSub.subscribe(event => {
      // console.log(event)

      // implement the changes given by the diffs
      const personDiff = event[0];
      personDiff.apply(selectedPersons)
      const emailsDiff = event[1];
      emailsDiff.apply(selectedEmails);

      // get arrays from dataset objects
      const personList = Object.values(persons);
      const emailList = Object.values(emails);
      const selectedPersonIDs = Object.values(selectedPersons).map(i => Number(i));
      const selectedEmailIDs = Object.values(selectedEmails).map(i => Number(i));

      // console.log(persons, emails)
      updateAM(personList, emailList, selectedPersonIDs, selectedEmailIDs);
    })


    function createAdjacencyMatrix(nodes: Node[], links: Edge[]) {
      const margin = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }

      const width = 750;
      const height = 750;


      const x = (<any>d3).scale.ordinal().rangeBands([0, width]);
      const z = (<any>d3).scale.linear().domain([0, 4]).clamp(true);
      const c = (<any>d3).scale.category10().domain(d3.range(10));

      const existingSVG = document.getElementById("AM-SVG");
      if (!existingSVG) {
        // SVG does not exist already, create it
        d3.select("#adj-matrix").append("svg")
          .attr("width", width + margin.left + margin.right)
          .attr("height", height + margin.top + margin.bottom)
          .attr("id", "AM-SVG")
          // .style("margin-left", -margin.left + "px")
          .append("g")
          .attr("transform", `translate(${margin.left}, ${margin.top})`);
      } else {
        d3.select("#AM-SVG").remove();
        d3.select("#adj-matrix").append("svg")
          .attr("width", width + margin.left + margin.right)
          .attr("height", height + margin.top + margin.bottom)
          .attr("id", "AM-SVG")
          // .style("margin-left", -margin.left + "px")
          .append("g")
          .attr("transform", `translate(${margin.left}, ${margin.top})`);
      }
      const svg = d3.select("#AM-SVG");


      type Cell = {
        x: number,
        y: number,
        z: number,
        selected?: boolean,
        from: Node,
        to: Node,
        sentiment: number, // total sentiment
      }

      // declare variable to store the matrix values
      const matrix: Cell[][] = []

      // variable to keep current number of nodes
      const n = nodes.length


      // Compute most importantly index but also other values for each node.
      nodes.forEach(function (node: Node, i) {
        node.index = i;
        node.count = 0;
        matrix[i] = d3.range(n).map(function (j) {
          return {
            x: j,
            y: i,
            z: 0,
            selected: false,
            from: node,
            to: nodes[j],
            sentiment: 0,
          };
        });
      });


      // Convert links to matrix, add values where appropriate
      links.forEach(function (link) {
        // add amount
        matrix[link.source][link.target].z += link.value;

        // add sentiment to node
        matrix[link.source][link.target].sentiment += link.sentiment;

        // add count and sentiment to nodes
        nodes[link.source].count += link.value;
        nodes[link.target].count += link.value;
        nodes[link.source].sentiment += link.sentiment;
        nodes[link.target].sentiment += link.sentiment;

        // set selected
        matrix[link.source][link.target].selected = link.selected;
      });

      // Precompute the sorting orders
      const orders = {
        name: d3.range(n).sort(function (a, b) { return d3.ascending(nodes[a].name, nodes[b].name); }),
        count: d3.range(n).sort(function (a, b) { return nodes[b].count - nodes[a].count; }),
        group: d3.range(n).sort(function (a, b) { return titleRanks[nodes[a].group] - titleRanks[nodes[b].group]; }),
        sentiment: d3.range(n).sort(function (a, b) { return nodes[b].count - nodes[a].count; }),
      };


      // get sort order from page
      const dropDown: any = document.getElementById("order")
      const sorter: "name" | "count" | "group" | "sentiment" = dropDown.value;


      // The default sort order.
      x.domain(orders[sorter]);

      svg.append("rect")
        .attr("class", "background")
        .attr("width", width)
        .attr("height", height);

      const rows = svg.selectAll(".row")
        .data(matrix)
        .enter().append("g")
        .attr("class", "row")
        .attr("transform", function (d, i) { return "translate(0," + x(i) + ")"; })
        .each(row);

      rows.append("line")
        .attr("x2", width);

      const column = svg.selectAll(".column")
        .data(matrix)
        .enter().append("g")
        .attr("class", "column")
        .attr("transform", function (d, i) { return "translate(" + x(i) + ")rotate(-90)"; });

      column.append("line")
        .attr("x1", -width);

      function row(row: Cell[]) {
        d3.select(this).selectAll(".cell")
          .data(row.filter(function (d) { return d.z; }))
          .enter().append("rect")
          .attr("class", "cell")
          .attr("x", function (d) { return x(d.x); })
          .attr("width", x.rangeBand())
          .attr("height", x.rangeBand())
          .style("fill-opacity", function (d) { return z(d.z); })
          .style("fill", selectColor)
          .on("mouseover", () => {
            return tooltip.style("visibility", "visible");
          })
          .on("mousemove", (d: Cell) => {
            return tooltip
              // this works but doesn't handle scaling
              .style("left", (`${(<any>d3).event.pageX}px`)).style("top", `${(<any>d3).event.pageY - 525}px`)
              .html(tooltipHTML(d));
          })
          .on("mouseout", () => {
            return tooltip.style("visibility", "hidden");
          })
          .on("click", clickCell);
      }

      // create tooltip
      let tooltip: d3.Selection<HTMLDivElement, unknown, any, any>;
      if (document.getElementsByClassName("tooltip").length === 0) {
        tooltip = d3.select("#adj-matrix")
          .append("div")
          .style("position", "absolute")
          .style("visibility", "hidden")
          .attr("class", "tooltip")
          .attr("id", "AM-tooltip")
          .style("background-color", "white")
          .style("border", "solid")
          .style("border-width", "1px")
          .style("border-radius", "3px")
          .style("padding", "4px")
          .style("font-size", "12px")
          .style("left", "10px").style("top", "10px")
          .style("text-align", "left")
      }
      tooltip = d3.select("#AM-tooltip");


      function tooltipHTML(c: Cell): string {
        let html = "";
        const sender = c.from;
        const receiver = c.to;

        // sender
        html += `From: <br>${sender.name}, ${sender.group}<br>`;

        // receiver
        html += `To: <br>${receiver.name}, ${receiver.group}<br>`;

        // num of emails
        html += `n.o. emails: ${c.z}<br>`;

        // total sentiment
        html += `Sum sentiment: ${c.sentiment.toFixed(3)}`;

        return html;
      }

      function selectColor(d: Cell): any {
        switch (sorter) {
          case "count":
            // use title colring
            return titleColor(d);
          case "group":
            // use title colring
            return titleColor(d);
          case "name":
            // use sentiment coloring
            return sentimentColor(d);
          case "sentiment":
            // use sentiment coloring
            return sentimentColor(d);
        }
      }

      function titleColor(d: Cell): String {
        if (d.selected === true) {
          return "#FF0000";
        } else {
          return nodes[d.x].group == nodes[d.y].group ? c(nodes[d.x].group) : null;
        }
      }

      function sentimentColor(d: Cell) {
        return "green";
      }

      function clickCell(cell: Cell): void {
        if (cell.selected) {
          // cell is selected -> unselect
          pushToSelectionSubject(
            [],
            [],
            getMatchingEmailIDs(cell.from.id, cell.to.id, Object.values(emails)
            ),
            [],
          )
        } else {
          // cell is not selected -> select
          pushToSelectionSubject(
            getMatchingEmailIDs(cell.from.id, cell.to.id, Object.values(emails)
            ),
            [],
            [],
            [],
          )
        }
      }

      d3.select("#order").on("change", function () {
        order((<any>this).value);
      });

      function order(value: string): void {
        x.domain((<any>orders)[value]);

        const t = svg.transition().duration(2500);

        t.selectAll(".row")
          .delay(function (d, i) { return x(i) * 4; })
          .attr("transform", function (d, i) { return "translate(0," + x(i) + ")"; })
          .selectAll(".cell")
          .delay(function (d: Cell) { return x(d.x) * 4; })
          .attr("x", function (d: Cell) { return x(d.x); });

        t.selectAll(".column")
          .delay(function (d, i) { return x(i) * 4; })
          .attr("transform", function (d, i) { return "translate(" + x(i) + ")rotate(-90)"; });
      }
    }

    // takes persons, emails and selections and update the on-screen matrix accordingly
    function updateAM(persons: Person[], emails: Email[], selPerIDs: number[], selEmIDs: number[]) {

      // get if user wants to see all nodes
      const showAllNodes: any = document.getElementById("show-all-nodes");
      const boolShowAllNodes: boolean = showAllNodes.checked;

      let nodes: Node[];

      //depending on if the user wants to see all nodes, calc what nodes we want
      if (!boolShowAllNodes) {
        // Creating array with person object
        const correspondants = Object.values(getCorrespondants(emails)); //dictionary with persons
        // turn personlist into nodes for adjacency matrix
        nodes = peopleToNodes(correspondants);
      } else {
        nodes = peopleToNodes(persons);
      }

      // get edges
      const links = edgeHash(emails, nodes, selEmIDs);

      // call adjacency matrix  
      // createAdjacencyMatrix(filteredCorrespondants, emailsToEdges(emails), svg);
      createAdjacencyMatrix(nodes, links);
    }

    // takes email IDs and sends them to selectionSubject (by first also calculating the persons involved)
    function pushToSelectionSubject(addEmailIDs: number[], addPersonIDs: number[], delEmailIDs: number[], delPersonIDs: number[]) {
      const emailDiff = new DataSetDiff;
      addEmailIDs.forEach((e) => {
        emailDiff.add(e.toString(), e)
      });
      delEmailIDs.forEach((e) => {
        emailDiff.remove(e.toString())
      });

      const personDiff = new DataSetDiff;

      selSub.next([personDiff, emailDiff]);
      // console.log(emailsDiff, personDiff)
    }
  }
}

// function to turn people objects into node usable by the matrix
function peopleToNodes(people: Person[]) {
  const nodes: Node[] = [];

  people.forEach((person) => {
    const newNode: Node = {
      name: emailToName(person.emailAdress),
      id: person.id,
      group: person.title,
    };
    nodes.push(newNode);
  })

  return nodes;
}

// tries to turn email into name with proper capitalisation of letters
export function emailToName(email: string) {
  let name: string = "";

  // remove everything behind @ and replace space with dot for next step
  const withoutAt = email.split('@')[0].replace(" ", ".")

  // split string at dots for each name part
  const parts: string[] = withoutAt.split(".");

  // capitalise first letter of each part
  for (let i = 0; i < parts.length; i++) {
    parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
  }

  // add parts back together, adding a dot if part is just one letter
  parts.forEach((part) => {
    if (part.length === 1) {
      name += part + ". ";
    } else {
      name += part + " ";
    }
  });

  // remove last space and return
  return name.slice(0, -1);
}

// takes emails and turns them into edges for the adjacency matrix, also account for selections
function edgeHash(emails: Email[], nodes: Node[], selEmIDs: number[]) {
  const edges: Edge[] = [];

  // for each email check if it is already in the edge list
  // if so, increase it's value, else add it with value 1
  emails.forEach((email) => {
    // get source in nodelist
    const source = nodes.findIndex((node) => {
      return email.fromId === node.id;
    });
    // get target in nodelist
    const target = nodes.findIndex((node) => {
      return email.toId === node.id;
    });

    const indexInEdges = edges.findIndex((edge) => {
      return edge.source === source && edge.target === target;
    })

    if (indexInEdges === -1) {
      // new edge

      // account for selected property
      let selected = false;
      if (selEmIDs.find((e) => { return e === email.id })) {
        selected = true;
      }

      const edge: Edge = {
        source: source,
        target: target,
        value: 1,
        sentiment: email.sentiment,
        selected: selected,
      }
      edges.push(edge);
    } else {
      // edge already exists
      edges[indexInEdges].value++;
    }

  })

  return edges;
}

// takes a sender, receiver and dataset and returns all datapoints with that sender/receiver combination in the dataset
function getMatchingEmailIDs(senderID: number, receiverID: number, emails: Email[]) {
  const IDs: number[] = [];

  emails.forEach((e) => {
    if (e.fromId === senderID && e.toId === receiverID) {
      IDs.push(e.id);
    }
  });

  return IDs;
}
