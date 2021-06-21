import { Node, Edge, Cell } from "./types";
import * as d3 from "d3";
import { titleColors, titleRanks } from "../constants";
import { Email, Title } from "../../data";
import { DataSet, DataSetDiff, ID, IDSetDiff } from "../../pipeline/dynamicDataSet";
import { Subject } from "rxjs";





// takes email IDs and sends them to selectionSubject (by first also calculating the persons involved)
function pushToSelectionSubject(selSub: Subject<[IDSetDiff, IDSetDiff]>, addEmailIDs: any[], addPersonIDs: any[], delEmailIDs: any[], delPersonIDs: any[]) {
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




function createMatrix(nodes: Node[], links: Edge[]): Cell[][] {
    // declare variable to store the matrix values
    const matrix: Cell[][] = []

    // Compute most importantly index but also other values for each node.
    nodes.forEach((node: Node, i) => {
        node.index = i;
        node.count = 0;

        matrix[i] = d3.range(nodes.length).map(j => ({
            unsortedPositionX: j,
            unsortedPositionY: i,
            emailCount: 0,
            selected: false,
            from: node,
            to: nodes[j],
            totalSentiment: 0,
        }))
    });

    // Convert links to matrix, add values where appropriate
    links.forEach(link => {
        // add amount
        matrix[link.source][link.target].emailCount += link.emailCount;

        // add sentiment to node
        matrix[link.source][link.target].totalSentiment += link.sentiment;

        // add count and sentiment to nodes
        nodes[link.source].count += link.emailCount;
        nodes[link.target].count += link.emailCount;
        nodes[link.source].sentiment += link.sentiment;
        nodes[link.target].sentiment += link.sentiment;

        // set selected
        matrix[link.source][link.target].selected = link.selected;
    });

    return matrix
}






export function createAdjacencyMatrix(selSubj: Subject<[IDSetDiff, IDSetDiff]>, emails: DataSet<Email>, nodes: Node[], links: Edge[], selectedPersons: DataSet<number>, selectedEmails: DataSet<number>) {
    const margin = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    }

    const width = 750;
    const height = 750;
    const sideBarWidth = 25;


    // scale dispalying the right cell at the right place
    const xScale = d3.scaleBand<number>().range([sideBarWidth, width])


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

    // get used titles
    const titleSet: any = new Set();
    nodes.forEach((p) => {
        titleSet.add(p.group);
    });
    const titleArr: Title[] = Array.from(titleSet);

    // declare SVG namespace so we can create SVG elements properly
    const svgns = 'http://www.w3.org/2000/svg';

    // make def block to put all gradient definitions in
    const defs = document.createElementNS(svgns, "defs");

    // define gradients for sentiment sorting
    const topSentGrad = document.createElementNS(svgns, "linearGradient");
    const leftSentGrad = document.createElementNS(svgns, "linearGradient");
    topSentGrad.setAttribute('id', "grad-sent-top");
    topSentGrad.setAttribute('x1', '100%');
    topSentGrad.setAttribute('y1', '0%');
    topSentGrad.setAttribute('x2', '0%');
    topSentGrad.setAttribute('y2', '0%');
    leftSentGrad.setAttribute('id', "grad-sent-left");
    leftSentGrad.setAttribute('x1', '0%');
    leftSentGrad.setAttribute('y1', '100%');
    leftSentGrad.setAttribute('x2', '0%');
    leftSentGrad.setAttribute('y2', '0%');

    const SentStop1 = document.createElementNS(svgns, "stop");
    SentStop1.setAttribute('offset', "0%");
    SentStop1.setAttribute('style', "stop-color:rgb(255,0,0);stop-opacity:1");

    const SentStop2 = document.createElementNS(svgns, "stop");
    SentStop2.setAttribute('offset', "100%");
    SentStop2.setAttribute('style', "stop-color:rgb(0,255,0);stop-opacity:1");

    // append all the elements together and add it to defs
    topSentGrad.appendChild(SentStop1);
    topSentGrad.appendChild(SentStop2);
    leftSentGrad.appendChild(SentStop1.cloneNode());
    leftSentGrad.appendChild(SentStop2.cloneNode());
    defs.appendChild(topSentGrad);
    defs.appendChild(leftSentGrad);

    // define gradients for titles for the top bar
    for (let i = 0; i < titleArr.length; i++) {
        const t: Title = titleArr[i]; // current title
        const linearGradient = document.createElementNS(svgns, "linearGradient");
        linearGradient.setAttribute('id', "grad-" + t.toString().replace(" ", "-") + "-top");
        linearGradient.setAttribute('x1', '0%');
        linearGradient.setAttribute('y1', '100%');
        linearGradient.setAttribute('x2', '0%');
        linearGradient.setAttribute('y2', '0%');

        const stop1 = document.createElementNS(svgns, "stop");
        stop1.setAttribute('offset', "0%");
        stop1.setAttribute('style', "stop-color:" + titleColors[t].color.border + ";stop-opacity:1");

        const stop2 = document.createElementNS(svgns, "stop");
        stop2.setAttribute('offset', "100%");
        stop2.setAttribute('style', "stop-color:" + titleColors[t].color.background + ";stop-opacity:1");

        // append all the elements together and add it to defs
        linearGradient.appendChild(stop1);
        linearGradient.appendChild(stop2);
        defs.appendChild(linearGradient);
    }
    // define gradients for titles for the left bar
    for (let i = 0; i < titleArr.length; i++) {
        const t: Title = titleArr[i]; // current title
        const linearGradient = document.createElementNS(svgns, "linearGradient");
        linearGradient.setAttribute('id', "grad-" + t.toString().replace(" ", "-") + "-left");
        linearGradient.setAttribute('x1', '100%');
        linearGradient.setAttribute('y1', '0%');
        linearGradient.setAttribute('x2', '0%');
        linearGradient.setAttribute('y2', '0%');

        const stop1 = document.createElementNS(svgns, "stop");
        stop1.setAttribute('offset', "0%");
        stop1.setAttribute('style', "stop-color:" + titleColors[t].color.border + ";stop-opacity:1");

        const stop2 = document.createElementNS(svgns, "stop");
        stop2.setAttribute('offset', "100%");
        stop2.setAttribute('style', "stop-color:" + titleColors[t].color.background + ";stop-opacity:1");

        // append all the elements together and add it to defs
        linearGradient.appendChild(stop1);
        linearGradient.appendChild(stop2);
        defs.appendChild(linearGradient);
    }

    // append all the defined gradients to the SVG
    document.getElementById("AM-SVG").appendChild(defs);


    const matrix = createMatrix(nodes, links);

    // use a threshold as bound on 0 to 100% opacity scale, so everything more than the threshold is 100% opacity
    // start by collecting all values
    let countValues: number[] = []; // index indicated value, value on that index is count (ignore 0's)
    for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix.length; j++) {
            const val = matrix[i][j].emailCount;
            if (val) {
                if (countValues[val] !== undefined) {
                    countValues[val]++;
                } else {
                    countValues[val] = 1;
                }
            }
        }
    }

    // calc threshold
    let totalLeft = 0;
    for (let i = 0; i < countValues.length; i++) {
        if (countValues[i]) {
            totalLeft += i * countValues[i];
        }
    }
    totalLeft = Math.floor(totalLeft / 2);
    let counter = 1;
    while (totalLeft > counter * countValues[counter]) {
        totalLeft = totalLeft - counter * countValues[counter];
        counter++;
    }
    // if counter is more than 4, use that as threshold, else use 4
    const threshold = counter > 4 ? counter : 4;
    const opacityScaler = d3.scaleLinear().domain([0, threshold]).clamp(true).range([0,0.5]);

    // Precompute the sorting orders
    const orders = {
        name: d3.range(nodes.length).sort(function (a, b) { return d3.ascending(nodes[a].name, nodes[b].name); }),
        count: d3.range(nodes.length).sort(function (a, b) { return nodes[b].count - nodes[a].count; }),
        group: d3.range(nodes.length).sort(function (a, b) { return titleRanks[nodes[a].group] - titleRanks[nodes[b].group]; }),
        sentiment: d3.range(nodes.length).sort(function (a, b) { return nodes[b].sentiment - nodes[a].sentiment; }),
    };

    type sortingSetting = "name" | "count" | "group" | "sentiment";

    // get sort order from page
    let dropDown: any = document.getElementById("order")
    let sorter: sortingSetting = dropDown.value;


    // The default sort order.
    xScale.domain(orders[sorter]);

    svg.append("rect")
        .attr("class", "background")
        .attr("width", width)
        .attr("height", height)
        .on('click', () => {
            // get IDs of selected emails
            const selEmIDs = Object.keys(selectedEmails);
            // get IDs of selected persons
            const selPerIDs = Object.keys(selectedPersons);

            // unselect everything
            pushToSelectionSubject(
                selSubj,
                [],
                [],
                selEmIDs,
                selPerIDs,
            )
        });

    const rows = svg.selectAll(".row")
        .data(matrix)
        .enter().append("g")
        .attr("class", "row")
        .attr("transform", function (d, i) { return "translate(0," + xScale(i) + ")"; })
        .each(row);

    rows.append("line")
        .attr("x2", width);

    const column = svg.selectAll(".column")
        .data(matrix)
        .enter().append("g")
        .attr("class", "column")
        .attr("transform", function (d, i) { return "translate(" + xScale(i) + ")rotate(-90)"; });

    column.append("line")
        .attr("x1", -width);

    function row(row: Cell[]) {
        d3.select(this).selectAll(".cell")
            .data(row.filter(function (d) { return d.emailCount }))
            .enter().append("rect")
            .attr("class", "cell")
            .attr("x", function (d) { return xScale(d.unsortedPositionX); })
            .attr("width", xScale.bandwidth())
            .attr("height", xScale.bandwidth())
            .style("fill-opacity", function (d) { return (d.selected) ? 1 : opacityScaler(d.emailCount) })
            .style("fill", function (d) { return selectColor(d, sorter) /*"FF0000"*/ })
            .on("mouseover", () => {
                return tooltip.style("visibility", "visible");
            })
            .on("mousemove", (event, d) => {
                return tooltip
                    .style("left", (`${event.pageX/* Its weird that this needs to be pageX, I don't know why this is*/}px`)).style("top", `${event.offsetY}px`)
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
            .style("left", "0px").style("top", "0px")
            .style("text-align", "left")
    }
    tooltip = d3.select("#AM-tooltip");

    // add sidebars
    let topWrapper = svg.append('g')
        .attr('class', 'sidebar')
        .attr('id', "top-bar-wrapper")
        .attr('transform', "translate(" + sideBarWidth.toString() + ",0)");
    topWrapper.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width - sideBarWidth)
        .attr('height', sideBarWidth)
        // .attr('stroke', "black")
        .attr('fill', "#eee")
        .attr('id', 'sidebar-background');
    let leftWrapper = svg.append('g')
        .attr('class', 'sidebar')
        .attr('id', "left-bar-wrapper")
        .attr('transform', "translate(0, " + sideBarWidth.toString() + ")");
    leftWrapper.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', sideBarWidth)
        .attr('height', height - sideBarWidth)
        // .attr('stroke', "black")
        .attr('fill', "#eee")
        .attr('id', 'sidebar-background');

    fillSidebars(sorter);

    // puts the right content in the sidebars based on current data and sorting settings 
    function fillSidebars(sorting: sortingSetting): void {
        let topWrapper = d3.select('#top-bar-wrapper');
        let leftWrapper = d3.select('#left-bar-wrapper');

        // start by clearing content of sidebars
        topWrapper.selectAll('#SB-content').remove();
        leftWrapper.selectAll('#SB-content').remove();

        // add content to sidebars based on sorting setting
        const strokeWeight = 2;
        switch (sorting) {
            case "count":
                break;
            case "group":
                // get which groups are currently used and tally the number of each
                const groupTally: { [group: string]: number } = {};
                nodes.forEach((n) => {
                    if (groupTally[n.group] === undefined) {
                        groupTally[n.group] = 1;
                    } else {
                        groupTally[n.group]++;
                    }
                });

                // sort the tally so it uses the same ordering as the titles
                let sortedOnTitle = Object.entries(groupTally).sort(function (a: [Title, number], b: [Title, number]) {
                    return titleRanks[a[0]] - titleRanks[b[0]];
                });

                //
                let before = 0; // used to know how many cells there were before the current
                const size = xScale.bandwidth();
                for (let i = 0; i < sortedOnTitle.length; i++) {
                    const amount = sortedOnTitle[i][1]; // get how many cells there are in this group
                    const boxLength = amount * size;
                    const spaceBefore = before * size;

                    // do top bar
                    let topTitlePart = topWrapper.append("g")
                        .attr("class", "title-part")
                        .attr('id', "SB-content")
                        .attr('transform', "translate(" + spaceBefore + ", 0)");  //placement at the right spot
                    topTitlePart.insert('rect')
                        .attr('y', -10)
                        .attr('width', boxLength - strokeWeight) // make sure each box is wide enough for the number of cells
                        .attr('height', sideBarWidth + 10)
                        .attr('stroke', "black")
                        .attr('rx', '10px')
                        .attr('stroke-width', strokeWeight + "px")
                        .attr('stroke', titleColors[sortedOnTitle[i][0]].color.border)
                        .attr('fill', "url(#grad-" + sortedOnTitle[i][0].replace(" ", "-") + "-top)");
                    // .attr('fill', titleColors[sortedOnTitle[i][0]].color.background);
                    topTitlePart.insert('text')
                        .text(sortedOnTitle[i][0])
                        .attr('transform', "translate(" + boxLength / 2 + "," + sideBarWidth / 2 + ")")
                        .attr('text-anchor', 'middle');
                    // do left bar
                    let leftTitlePart = leftWrapper.append("g")
                        .attr("class", "title-part")
                        .attr('id', "SB-content")
                        .attr('transform', "translate(0, " + spaceBefore + ")");  //placement at the right spot
                    leftTitlePart.insert('rect')
                        .attr('x', -10)
                        .attr('y', 0) // start at the right spot
                        .attr('width', sideBarWidth + 10)
                        .attr('height', boxLength - strokeWeight) // make sure each box is wide enough for the number of cells
                        .attr('stroke', "black")
                        .attr('rx', '10px')
                        .attr('stroke-width', strokeWeight + "px")
                        .attr('stroke', titleColors[sortedOnTitle[i][0]].color.border)
                        .attr('fill', "url(#grad-" + sortedOnTitle[i][0].replace(" ", "-") + "-left)");
                    // .attr('fill', titleColors[sortedOnTitle[i][0]].color.background);
                    leftTitlePart.insert('text')
                        .text(sortedOnTitle[i][0])
                        .attr('transform', "translate(" + sideBarWidth / 2 + "," + boxLength / 2 + ")rotate(-90)")
                        .attr('text-anchor', "middle");

                    before += amount;
                }

                break;
            case "name":
                // top bar
                topWrapper.insert('rect')
                    .attr('id', "SB-content")
                    .attr('y', -10)
                    .attr('width', width - sideBarWidth - strokeWeight)
                    .attr('height', sideBarWidth + 10)
                    .attr('stroke', "black")
                    .attr('rx', '10px')
                    .attr('stroke-width', strokeWeight + "px")
                    .attr('stroke', "black")
                    .attr('fill', "aquamarine");
                // top A
                topWrapper.append('text')
                    .attr('transform', "translate(10," + 2 * sideBarWidth / 3 + ")")
                    .text('A')
                    .attr('id', "SB-content");
                // top Z
                topWrapper.append('text')
                    .attr('transform', "translate(" + (width - sideBarWidth - 10) + "," + 2 * sideBarWidth / 3 + ")")
                    .text('Z')
                    .attr('text-anchor', "end")
                    .attr('id', "SB-content");

                // left bar
                leftWrapper.insert('rect')
                    .attr('id', "SB-content")
                    .attr('x', -10)
                    .attr('width', sideBarWidth + 10)
                    .attr('height', width - sideBarWidth - strokeWeight)
                    .attr('stroke', "black")
                    .attr('rx', '10px')
                    .attr('stroke-width', strokeWeight + "px")
                    .attr('stroke', "black")
                    .attr('fill', "aquamarine");
                // left A
                leftWrapper.append('text')
                    .attr('transform', "translate(" + 2 * sideBarWidth / 3 + ", 18)")
                    .text('A')
                    .attr('text-anchor', "end")
                    .attr('id', "SB-content");
                // left Z
                leftWrapper.append('text')
                    .attr('transform', "translate(" + 2 * sideBarWidth / 3 + "," + (width - sideBarWidth - 10) + ")")
                    .text('Z')
                    .attr('text-anchor', "end")
                    .attr('id', "SB-content");

                break;
            case "sentiment":
                // top bar
                topWrapper.insert('rect')
                    .attr('id', "SB-content")
                    .attr('y', -10)
                    .attr('width', width - sideBarWidth - strokeWeight)
                    .attr('height', sideBarWidth + 10)
                    .attr('stroke', "black")
                    .attr('rx', '10px')
                    .attr('stroke-width', strokeWeight + "px")
                    .attr('stroke', "black")
                    .attr('fill', "url(#grad-sent-top");
                // left bar
                leftWrapper.insert('rect')
                    .attr('id', "SB-content")
                    .attr('x', -10)
                    .attr('width', sideBarWidth + 10)
                    .attr('height', width - sideBarWidth - strokeWeight)
                    .attr('stroke', "black")
                    .attr('rx', '10px')
                    .attr('stroke-width', strokeWeight + "px")
                    .attr('stroke', "black")
                    .attr('fill', "url(#grad-sent-left");
                break;
        }
    }


    function selectColor(d: Cell, sorting: String): any {
        if (d.selected) {
            return "#FF00FF"
        } else {
            switch (sorting) {
                case "count":
                    // use sentiment coloring
                    return sentimentColoring(d);
                case "group":
                    // use title coloring
                    return titleColoring(d);
                case "name":
                    // use title coloring
                    return titleColoring(d);
                case "sentiment":
                    // use sentiment coloring
                    return sentimentColoring(d);
            }
        }
    }


    function sentimentColoring(d: Cell) {
        // take sentiment and map to spectrum from red to green

        // pos enough when sentiment > 0.01
        if (d.totalSentiment > 0.01) {
            const hue = d.totalSentiment > 0.05 ? 120 : 90 + (d.totalSentiment - 0.01) * 750;
            return "hsl(" + hue.toString() + ", 100%, 45%)"
        }

        // neg enough when sentiment < -0.01
        if (d.totalSentiment < -0.01) {
            const hue = d.totalSentiment < -0.05 ? 0 : 30 - + (d.totalSentiment + 0.01) * 750;
            return "hsl(" + hue.toString() + ", 100%, 45%)"
        }

        // not pos or negative
        return null
        // const tanhVal = Math.tanh(d.sentiment*10);
        // const hue =  60 * tanhVal + 60 // tanh returns number in (-1, 1), scale to (0, 120)
        // let sat = 10000 * Math.abs(tanhVal);
        // if (sat > 100){ sat = 100}
        // return "hsl("+ hue.toString() + ", "+ sat +"%, 50%)"
    }


    function clickCell(e: Event, cell: Cell): void {
        if (cell.selected) {
            // cell is selected -> unselect
            pushToSelectionSubject(
                selSubj,
                [],
                [],
                getMatchingEmailIDs(cell.from.id, cell.to.id, Object.values(emails)
                ),
                [],
            )
        } else {
            // cell is not selected -> select
            pushToSelectionSubject(
                selSubj,
                getMatchingEmailIDs(cell.from.id, cell.to.id, Object.values(emails)
                ),
                [],
                [],
                [],
            )
        }
    }

    d3.select("#order").on("change", e => {
        order(e.target.value);
    });

    function order(sorter: sortingSetting): void {
        xScale.domain(orders[sorter]);

        const t = svg.transition().duration(2500);

        // redo sidebars
        fillSidebars(sorter);

        t.selectAll(".row")
            .delay((_, i) => xScale(i) * 4)
            .attr("transform", (d, i) => "translate(0," + xScale(i) + ")")
            .selectAll(".cell")
            .delay((d: Cell) => xScale(d.unsortedPositionX) * 4)
            .attr("x", (d: Cell) => xScale(d.unsortedPositionX))
            .style("fill", (d: any) => selectColor(d, sorter))

        t.selectAll(".column")
            .delay((_, i) => xScale(i) * 4 )
            .attr("transform", (_, i) => "translate(" + xScale(i) + ")rotate(-90)");
    }
}




function titleColoring(d: Cell): String {
    return d.from.group == d.to.group ? titleColors[d.from.group].color.border : null;
}







function tooltipHTML(c: Cell): string {
    let html = "";
    const sender = c.from;
    const receiver = c.to;

    // sender
    html += `From: <br>${sender.name}, ${sender.group}<br>`;

    // receiver
    html += `To: <br>${receiver.name}, ${receiver.group}<br>`;

    // num of emails
    html += `n.o. emails: ${c.emailCount}<br>`;

    // total sentiment
    html += `Sum sentiment: ${c.totalSentiment.toFixed(3)}`;

    return html;
}