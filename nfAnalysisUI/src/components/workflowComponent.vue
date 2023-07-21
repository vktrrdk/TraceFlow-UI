<script setup lang="ts">
import { onMounted, reactive, ref, setTransitionHooks, toRaw, watch } from "vue";
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap/dist/js/bootstrap.min.js"
import type { RunTrace } from "@/models/RunTrace";
import { useRouter, useRoute } from "vue-router";
import axios from "axios";
import { Chart, LinearScale, CategoryScale } from 'chart.js/auto';
import { BoxPlotController, BoxAndWiskers } from '@sgratzl/chartjs-chart-boxplot';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import MultiSelect from "primevue/multiselect";
import { FilterMatchMode } from 'primevue/api';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message'; // could replace alerts
import OrganizationChart from 'primevue/organizationchart'; // could be useful to show stuff
import Timeline from 'primevue/timeline'; // per task (process instance) --> show progress instead of a bar
import Skeleton from 'primevue/skeleton'; // while loading
import ProgressSpinner from 'primevue/progressspinner'; // same
import Listbox from 'primevue/listbox'; // for top
import Panel from 'primevue/panel';
import Knob from 'primevue/knob';
import Steps from 'primevue/steps';


/**
 *
 * We need a function that transforms the indexes of the tasks per process into menuItem-like objects
 * So we can use these menu items to toggle between the tasks in a process accordion
 *
 * */

Chart.register(BoxPlotController, BoxAndWiskers, LinearScale, CategoryScale);

const router = useRouter();
const route = useRoute();


const props = defineProps<{
  token: string;
}>();

const STATUSES = ['SUBMITTED', 'RUNNING', 'COMPLETED', 'FAILED'];
const filters = ref({
  'status': { value: null, matchMode: FilterMatchMode.IN },
  'name': { value: null, matchMode: FilterMatchMode.CONTAINS },
  'process': { value: null, matchMode: FilterMatchMode.CONTAINS },
  'tag': { value: null, matchMode: FilterMatchMode.CONTAINS },

});

const workflowState = reactive<{
  pollInterval: number;
  loading: boolean;
  token: string;
  token_info_requested: boolean;
  error_on_request: boolean;
  process_state: any;
  filteredProcesses: any;
  state_by_task: any;
  selectedKeys: string[];
  selectedProcesses: string[];
  selectionFilters: any;
  //connection: WebSocket;
}>({
  pollInterval: 10000,
  loading: true,
  token: "",
  token_info_requested: false,
  error_on_request: false,
  process_state: {},
  filteredProcesses: {},
  state_by_task: {},
  selectedKeys: [],
  selectedProcesses: [],
  selectionFilters: {},
  //connection: null,
});

const metricCharts = reactive<{
  memoryChart: any | null;
  memoryCanvas: any | null;
  relativeMemoryChart: any | null;
  relativeMemoryCanvas: any | null;
  ioChart: any | null;
  ioCanvas: any | null;
  cpuChart: any | null;
  cpuCanvas: any | null
  durationChart: any | null;
  durationCanvas: any | null;
  dynamicChart: any | null;
  dynamicCanvas: any | null;
}>({
  memoryChart: null,
  memoryCanvas: null,
  relativeMemoryChart: null,
  relativeMemoryCanvas: null,
  ioChart: null,
  ioCanvas: null,
  cpuChart: null,
  cpuCanvas: null,
  durationChart: null,
  durationCanvas: null,
  dynamicChart: null,
  dynamicCanvas: null,
});

const filterState = reactive<{
  availableProcesses: string[];
  availableTags: string[];
  selectedProcesses: string[];
  selectedProgressProcesses: string[];
  selectedTags: string[];
  tagTaskMapping: any;
  processTaskMapping: any;

}>({
  availableProcesses: [],
  availableTags: [],
  selectedProcesses: [],
  selectedProgressProcesses: [],
  selectedTags: [],
  processTaskMapping: {},
  tagTaskMapping: {},

});



function getDataInitial(token = props.token) {
  if (token.length > 0) {
    workflowState.loading = true;
    axios.get(`http://localhost:8000/run/${token}/`).then(
      response => {
        if (response.data["error"]) {
          workflowState.state_by_task = [];
          workflowState.error_on_request = true;

        } else {
          workflowState.state_by_task = response.data["result_by_task"];
          workflowState.process_state = response.data["result_processes"];
          workflowState.token_info_requested = true;
          workflowState.token = token;
          workflowState.error_on_request = false;
          filterState.processTaskMapping = mapAvailableProcesses();
          filterState.availableProcesses = getProcessNamesOnly();
          filterState.selectedProcesses = filterState.availableProcesses;
          progressProcessSelectionChanged();
          filterState.tagTaskMapping = mapAvailableTags();
          filterState.tagTaskMapping = getTagNamesOnly(); // this could be tricky, tags could be list of single tags

          createPlots();
          dataPollingLoop();
          //generateBoxPlotMultiByKeys(['memory', 'vmem', 'rss'], 'ram_multiple_canvas', true, 'MiB', ['Requested memory in ', 'Virtual memory in ', 'Physical memory in '], 'Memory');
          //generateBoxPlotMultiByKeys([], 'memory_percentage', true, '%', ['Memory usage in '], 'Relative memory usage', generateKeyRelativeData, ['rss', 'memory', 'Memory usage in %', 100]);
          //generateBoxPlotMultiByKeys(['read_bytes', 'write_bytes'], 'read_write_canvas', true, 'MiB', ['Read in ', 'Written in '], 'I/O'),
          //generateBoxPlotMultiByKeys([], 'cpu_canvas', true, '%', ['Raw usage in ', 'Allocated in '], 'CPU', generateCPUData);
          //createDynamicDataPlot();
          // generateDurationSumChart();

          //addRamAllocationPercentageToGraph();
          /*
          - add IO read write graph
          - add CPU raw usage and % allocated graph
          */
        }
      },
    );
    //workflowState.connection = new WebSocket(`wss://localhost:8000/run/${token}`);
    //workflowState.connection. TODO: add websocket stuff

  }

}

function dataPollingLoop() {
  axios.get(`http://localhost:8000/run/${workflowState.token}/`).then(
    response => {
      if (response.data["error"]) {
        workflowState.state_by_task = [];
        workflowState.error_on_request = true;

      } else {
        workflowState.state_by_task = response.data["result_by_task"];
        workflowState.process_state = response.data["result_processes"];
        workflowState.token_info_requested = true;
        workflowState.error_on_request = false;
        filterState.availableProcesses = getProcessNamesOnly();
        //filterState.selectedProcesses = filterState.availableProcesses;
        // check how this is, when "all" are selected
        updateIOPlot();
        
      }
    }).finally((): void => {
      setTimeout(dataPollingLoop, 10000); 
    })
    
}

async function createPlots() {
  await delay(300);
  createRamPlot();
  createRelativeRamPlot();
  createCPUPlot();
  createIOPlot();
  createDurationPlot();
}


async function createRelativeRamPlot() {
  const canvas: HTMLCanvasElement = generateDiv('relative_ram_canvas', 'Relative RAM');
  metricCharts.relativeMemoryCanvas = canvas;
  await delay(300);
  const relativeRamChart = new Chart(
    metricCharts.relativeMemoryCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(relativeRamChart);
  metricCharts.relativeMemoryChart = relativeRamChart;

  updateRelativeRamPlot();
}

async function createIOPlot() {

  const canvas: HTMLCanvasElement = generateDiv('io_canvas', 'I/O');
  metricCharts.ioCanvas = canvas;
  await delay(300);

  const ioChart = new Chart(
    metricCharts.ioCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(ioChart);
  metricCharts.ioChart = ioChart;

  updateIOPlot();
}

async function createDurationPlot() {
  const canvas: HTMLCanvasElement = generateDiv('duration_canvas', 'Duration');
  metricCharts.durationCanvas = canvas;
  await delay(300);
  const durationChart = new Chart(
    metricCharts.durationCanvas,
    {
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(durationChart);
  metricCharts.durationChart = durationChart;

  updateDurationPlot();
}

async function createRamPlot() {
  const canvas: HTMLCanvasElement = generateDiv('ram_canvas', 'RAM');
  metricCharts.memoryCanvas = canvas;
  await delay(300);

  const memoryChart = new Chart(
    metricCharts.memoryCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(memoryChart);
  metricCharts.memoryChart = memoryChart;

  updateRamPlot();
}

async function createCPUPlot() {
  const canvas: HTMLCanvasElement = generateDiv('cpu_canvas', 'CPU');
  metricCharts.cpuCanvas = canvas;
  await delay(300);
  const cpuChart = new Chart(
    metricCharts.cpuCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(cpuChart);
  metricCharts.cpuChart = cpuChart;

  updateCPUPlot();
}

function updatePlots() {
  updateRamPlot()
  //updateRelativeRamPlot();
  updateCPUPlot();
  updateIOPlot();
  updateDurationPlot();
}

function updateIOPlot() {
  let generatedDatasets: [string[], any[]] = generateDataByMultipleKeys(
    ['read_bytes', 'write_bytes'],
    true,
    'MiB',
    ['Read in ', 'Written in '],
    filterState.selectedProcesses
  );

  metricCharts.ioChart.data.labels = getSuffixes(generatedDatasets[0]);
  metricCharts.ioChart.data.datasets = generatedDatasets[1];
  metricCharts.ioChart.update('none');
}

function updateRamPlot() {
  let generatedDatasets: [string[], any[]] = generateDataByMultipleKeys(
    ['memory', 'vmem', 'rss'],
    true,
    'MiB',
    ['Requested memory in ', 'Virtual memory in ', 'Physical memory in '],
    filterState.selectedProcesses,
  );

  metricCharts.memoryChart.data.labels = getSuffixes(generatedDatasets[0]);
  metricCharts.memoryChart.data.datasets = generatedDatasets[1];
  metricCharts.memoryChart.update('none');
}

function updateCPUPlot() {
  /** check this out! **/
  let generatedDatasets: [string[], any[]] = generateCPUData();

  metricCharts.cpuChart.data.labels = getSuffixes(generatedDatasets[0]);
  metricCharts.cpuChart.data.datasets = generatedDatasets[1];
  metricCharts.cpuChart.update('none');
}

function updateDurationPlot() {
  let generatedDatasets: [string[], any[]] = generateDurationData();
  // getSuffixes is already part of generateDurationData-function
  metricCharts.durationChart.data.labels = generatedDatasets[0];
  metricCharts.durationChart.data.datasets = generatedDatasets[1];
  metricCharts.durationChart.update('none');
}

function updateRelativeRamPlot() {
  // check
}

function getProcessNamesOnly(): string[] {
  let state: any = toRaw(filterState.processTaskMapping);
  return Object.keys(state);
}

function mapAvailableProcesses(): any {
  let result: any = {};
  let state: any = toRaw(workflowState.process_state);
  let keys: string[] = transformStrings(Object.keys(state));
  // console.log(findDuplicates(keys)); there are none..
  for (let key of keys) {
    let tasks: any = state[key]['tasks'];
    result[key] = Object.keys(tasks);
  }

  return result;
}




function getTagNamesOnly(): string[] {
  //TODO implement;
  return [];
}

function mapAvailableTags(): any {
  let result: any = {};
  let state: any = toRaw(workflowState.process_state);
  for (let process in state) {

    let tasks: any = state[process]['tasks'];
    for (let task in tasks) {
      let tag: any = tasks[task]['tag'];
      if (!(tag in result)) {
        result[tag] = [task];
      } else {
        result[tag].push(task);
      }
    }
  }
  return result;

}
/*
 again openai:
in javascript, i have a list of strings, which have the following format:
'a:b:c...', with a, b,c and so on being substrings.
i want a function to transform these strings, which have ':'-chars as concatenators so only the distinguishable part at the end of the string is left.

so the folliwing input should produce the following output:

input: ['abc:def:ghi', 'abc:fer:der', 'esf:ang:der', 'esf:ang:zir']
output: ['ghi', 'fer:der', 'ang:der', 'zir']
 */
function transformStrings(input) {
  return input;
}



function findDuplicates(arr: any) {
  let sorted_arr = arr.slice().sort(); // You can define the comparing function here.
  // JS by default uses a crappy string compare.
  // (we use slice to clone the array so the
  // original array won't be modified)
  let results = [];
  for (let i = 0; i < sorted_arr.length - 1; i++) {
    if (sorted_arr[i + 1] == sorted_arr[i]) {
      results.push(sorted_arr[i]);
    }
  }
  return results;
}


function sortTraces(a: RunTrace, b: RunTrace): number {
  if (Date.parse(a.timestamp) < Date.parse(b.timestamp)) {
    return -1;
  } else {
    return 1;
  }
}

function getProgressValue(task: any): number {
  let x: number = 0
  if (task["status"] === "SUBMITTED") {
    x = 10
  } else if (task["status"] === "RUNNING") {
    x = 50
  } else if (task["status"] === "COMPLETED") {
    x = 100
  }
  return x;
}

function processNumbers(info: any): string {
  const currently_submitted: number = getNumberOfTasksForProcess(info);
  const completed = getNumberOfCompletedSubprocesses(info);
  return `${completed} / ${currently_submitted}`;
}

function getNumberOfTasksForProcess(info: any): number {
  const subprocesses: any = info["tasks"];
  let currently_submitted: number = 0;
  for (let elem in subprocesses) {
    currently_submitted += 1;
  }
  return currently_submitted
}

function getProcessCurrentScore(info: any): number {
  const subprocesses: any = info["tasks"];
  let score: number = 0;
  for (let sb in subprocesses) {
    let status: string = subprocesses[sb]["status"];
    if (status == "SUBMITTED") {
      score += 10;
    } else if (status == "RUNNING") {
      score += 50;
    } else if (status == "COMPLETED") {
      score += 100;
    }
  }
  return score;
}


function getNumberOfCompletedSubprocesses(info: any): number {
  const subprocesses: any = info["tasks"];
  let completed: number = 0;
  for (let sb in subprocesses) {
    if (subprocesses[sb]["status"] === "COMPLETED") {
      completed += 1;
    }
  }
  return completed;
}

function deleteToken(token: string) {
  // needs implementation
}


function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



function reasonableDataFormat(input: number) {
  const types: string[] = ['b', 'kiB', 'MiB', 'GiB', 'TiB'];
  let iteration: number = 0;
  while (input >= 1024 && iteration < types.length) {
    input = input / 1024;
    iteration += 1;
  }

  return `${input.toFixed(3)} ${types[iteration]}`;
}

function getDataInValidFormat(byte_numbers: number[], wantedType: string): [number[], string] {
  const types: string[] = ['b', 'kiB', 'MiB', 'GiB'];
  let iteration: number = 0;

  if (byte_numbers.length > 0) {
    while (byte_numbers.some(elm => elm > 10000) && iteration < types.length - 1 && types[iteration] !== wantedType) {
      byte_numbers = byte_numbers.map((num): number => num / 1024);
      iteration++;
    }
  }
  return [byte_numbers, types[iteration]]

}

function generateSummarizedDataByKey(key: string, factorizer: number = 1): any {
  let data_pair: any = {};
  data_pair["labels"] = [];
  data_pair["data"] = [];
  let states: any = toRaw(workflowState.process_state);
  for (let process in states) {
    if (filterState.selectedProcesses.includes(process)) {
      data_pair["labels"].push(process);
      let tasks: any = states[process]['tasks'];
      let values: number[] = [];
      for (let task_id in tasks) {
        values.push(tasks[task_id][key]);
      }
      if (factorizer !== 1) {
        values = values.map((elem) => elem / factorizer);
      }
      data_pair["data"].push(values.reduce((a, b) => a + b, 0));
    }
  }

  return data_pair;
}


function generateDataByKey(key: string, adjustFormat: boolean, wantedFormat: string): any {
  let data_pair: any = {};
  data_pair["labels"] = [];
  data_pair["data"] = [];
  data_pair['type'] = wantedFormat;
  let states: any = toRaw(workflowState.process_state);
  for (let process in states) {
    if (filterState.selectedProcesses.includes(process)){
      data_pair["labels"].push(process);
      let tasks: any = states[process]['tasks'];
      let values: number[] = [];
      for (let task_id in tasks) {
        values.push(tasks[task_id][key]);
      }
      if (adjustFormat) {
        data_pair["data"].push(getDataInValidFormat(values, wantedFormat)[0]);
      } else {
        data_pair["data"].push(values);
      }
      values = [values.reduce((a, b) => a + b, 0)];
      data_pair["data"].push(values);
    }
  }
  return data_pair;

}



function generateDataByMultipleKeys(keys: string[], adjust: boolean, wantedFormat: string, label: string[], processFilter: string[] = []): any {
  let datasets: any[] = [];
  let labels: string[] = [];
  let states: any = toRaw(workflowState.process_state);
  let first_loop: boolean = true;
  let key_index = 0;
  let processesToFilterBy: string[] = filterState.availableProcesses;
  if (processFilter.length !== 0) {
    processesToFilterBy = toRaw(processFilter);
  }
  for (let key of keys) {
    let single_dataset: any = { 'label': label[key_index] + wantedFormat, data: [] };
    for (let process in states) {
      if (processesToFilterBy.includes(process)) {
        // now check why the chart generation fails;
        let values: any[] = [];
        if (first_loop) {
          labels.push(process)
        }
        let tasks: any = states[process]['tasks'];
        for (let task_id in tasks) {
          values.push(tasks[task_id][key]);
        }
        if (adjust) {
          single_dataset['data'].push(getDataInValidFormat(values, wantedFormat)[0]);
        } else {
          single_dataset['data'].push(values);
        }
      }
    }
    datasets.push(single_dataset);
    first_loop = false;
    key_index += 1;
  }
  return [labels, datasets];
}



function generateMemoryRelativeData(): [string[], any[]] {
  let datasets: any[] = [];
  let labels: string[] = [];
  let states: any = toRaw(workflowState.process_state);
  let relative_dataset: any = { 'label': 'Memory usage in %', 'data': [] }
  for (let process in states) {
    labels.push(process);
    let processValues: any[] = [];
    let tasks: any = states[process]['tasks'];
    for (let task_id in tasks) {
      processValues.push(
        (tasks[task_id]['rss'] / tasks[task_id]['memory']) * 100
      );
    }
    relative_dataset['data'].push(processValues);
  }
  datasets.push(relative_dataset);
  return [labels, datasets];

}

function generateKeyRelativeData(dataKey: string, respectToKey: string, label: string, factor: number = 100): [string[], any[]] {
  let datasets: any[] = [];
  let labels: string[] = [];
  let states: any = toRaw(workflowState.process_state);
  let relative_dataset: any = { 'label': label, 'data': [] }
  for (let process in states) {
    labels.push(process);
    let processValues: any[] = [];
    let tasks: any = states[process]['tasks'];
    for (let task_id in tasks) {
      processValues.push(
        (tasks[task_id][dataKey] / tasks[task_id][respectToKey]) * factor
      );
    }
    relative_dataset['data'].push(processValues);
  }
  datasets.push(relative_dataset);
  return [labels, datasets];
}

function generateCPUData(): [string[], any[]] {
  let datasets: any[] = [];
  let labels: string[] = [];
  let states: any = toRaw(workflowState.process_state);
  let values: any = {};

  for (let process in states) {
    if (filterState.selectedProcesses.includes(process)) {
      labels.push(process);
      let tasks: any = states[process]['tasks'];
      if (!(process in values)) {
        values[process] = {'cpus': [], 'realtime': []};
      }
      for (let task_id in tasks) {
        values[process]['cpus'].push(tasks[task_id]['cpus']);
        values[process]['realtime'].push(tasks[task_id]['realtime']);
      }
    }
  }

  let allocation_data = [];
  let raw_usage_data = [];
  for (let process in values) {
    let value_numerator: number = 0;
    let value_denominator: number = 0;
    let values_raw: number[] = [];
    let idx: number = 0;
    while (idx < values[process]['cpus'].length) {
      value_numerator += values[process]['cpus'][idx] * (values[process]['realtime'][idx] / 1000)
      value_denominator += (values[process]['realtime'][idx] / 1000);
      values_raw.push(values[process]['cpus'][idx] * 100)
      idx += 1;
    }
    let value: number = 0;
    if (value_denominator > 0) {
      value = value_numerator / value_denominator;
    }

    allocation_data.push([value * 100]);
    raw_usage_data.push(values_raw);
  }
  datasets.push({ 'label': 'Requested CPU used in %', 'data': allocation_data })
  datasets.push({ 'label': 'CPU usage in %', 'data': raw_usage_data });

  return [labels, datasets]
}





// how to combine the metrics from currentState and process state - what about meta?
// more data from api needed - otherwise no possibility to show all relevant metrics
// check chart.js and available visualizations in nf-tower


/**
 * geht bestimmt noch einfacher - async? warum immer warten bis das ganze fertig ist...
 */
function generateDiv(elementId: string, title: string): HTMLCanvasElement {
  const divWithCanvas = document.createElement('div');
  const titleElement = document.createElement('h5');
  titleElement.textContent = title;
  divWithCanvas.style.width = '80vw';
  const canvas = document.createElement('canvas');
  canvas.id = elementId;
  divWithCanvas.appendChild(titleElement);
  divWithCanvas.appendChild(canvas);
  const targetDiv = document.getElementById('canvas_area');
  targetDiv.appendChild(divWithCanvas);
  return canvas;
}

/**
 * openai: chatgpt - prompt: in javascript, take a list of strings, which can be splitted using the character ':'.
 how to write a function, which returns the suffixes of those strings, where the prefix of the word is removed, which is the same for all strings in the list
 ___
 needs to be adjusted - returns 'owtie:Aling' and so on, instead of removing the bowtie part or do we want to keep the whole bowtie stuff? check this again
 result:
 */
function getSuffixes(strings) {
  return strings.map(str => {
    const parts = str.split(':');
    return parts[parts.length - 1];
  });
}

function emptyFunction(): [string[], any[]] {
  return [[], []];
}

async function generateBoxPlotMultiByKeys(keys: string[], canvasID: string, adjust: boolean, format: string, label: string[], title: string, func: (...params: any) => [string[], any[]] = emptyFunction, args: any[] = []) {
  let generatedDatasets: [string[], any[]] = [[], []];
  if (func === emptyFunction) {
    generatedDatasets = generateDataByMultipleKeys(keys, adjust, format, label);
  } else {
    if (args.length > 0) {
      generatedDatasets = func(...args);
    } else {
      generatedDatasets = func();
    }

  }

  await delay(300);
  let canvas = generateDiv(canvasID, title);
  new Chart(
    canvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        }
      },
      data: {
        labels: getSuffixes(generatedDatasets[0]),
        datasets: generatedDatasets[1],
      }
    }
  );
}



function generateDurationData(): [string[], any[]] {
  let data_sum = generateSummarizedDataByKey('duration', 1000);
  console.log(data_sum);
  let data_exec = generateDataByKey('realtime', false, 's')['data'];
  let data_execution: any[] = [];
  data_exec.forEach((element: any[]) => {
    let mapped: any[] = element.map((value) => value / 1000);
    data_execution.push(mapped);
  });
  let data_allocated = generateKeyRelativeData('realtime', 'time', 'Requested time used in %', 100)[1];

  let datasets: any[] =
          [
            {
              type: 'bar',
              label: `Summarized Duration in seconds`,
              //data: data["data"],
              data: data_sum["data"],
            },
            {
              type: 'boxplot',
              label: 'Execution in real-time',
              data: data_execution,
            },
            {
              type: 'boxplot',
              label: 'Requested time used in %',
              data: data_allocated[1],
            }
          ];
  return [getSuffixes(data_sum["labels"]), datasets];

}


async function createDynamicDataPlot() {

  // check https://www.chartjs.org/docs/latest/developers/charts.html#new-charts
  // and https://www.chartjs.org/docs/latest/developers/updates.html

  // update in the future!



  await delay(300);
  let canvas = generateDiv('dynamic_canvas', 'Dynamic metrics');
  metricCharts.dynamicCanvas = canvas;

  const dynChart = new Chart(
    metricCharts.dynamicCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(dynChart);
  metricCharts.dynamicChart = dynChart;
}

async function updateDynamicMetrics(): Promise<void> {
  await delay(300);
  let generatedDatasets: [string[], any[]] = generateDataByMultipleKeys(['vmem', 'rss'], true, 'MiB', ['Virtual (d) in ', 'Physical (d) in '], filterState.selectedProcesses);

  metricCharts.dynamicChart.data.labels = getSuffixes(generatedDatasets[0]);
  metricCharts.dynamicChart.data.datasets = generatedDatasets[1];
  metricCharts.dynamicChart.update();

}

function getFilteredProcesses(): any[] {
  let filtered: any = {};
  for (let process in workflowState.process_state) {
    if (filterState.selectedProgressProcesses.includes(process)) {
      console.log("true");
      filtered[process] = workflowState.process_state[process];
    }
  }
  return filtered;
}


function progressProcessSelectionChanged(): void {
  workflowState.filteredProcesses = getFilteredProcesses();
}

function metricProcessSelectionChanged(): void {
  console.log(filterState.selectedProcesses);
  updatePlots();
}


onMounted(() => {
  getDataInitial();

});
</script>

<template>
  <div class="card" v-if="!workflowState.token || workflowState.error_on_request">
    <h5 class="card-header">Enter token</h5>
    <div class="card-body">
      <div class="alert"
        :class="{ 'alert-dark': !workflowState.error_on_request, 'alert-danger': workflowState.error_on_request }">
        Please enter a valid token to show the corresponding workflow information for this token.
        <strong>The entered token is not valid.</strong>
      </div>
      <div class="input-group mb-3">
        <span class="input-group-text" id="basic-addon1">Token</span>
        <input v-model="workflowState.token" type="text" class="form-control" placeholder="Token" aria-label="token"
          aria-describedby="basic-addon1">
        <button @click="getDataInitial(workflowState.token)" class="btn btn-outline-primary" type="button">Show</button>
      </div>
    </div>
  </div>
  <div v-if="workflowState.token && workflowState.token_info_requested">
    <h5 class="card-header">Workflow information for token {{ workflowState.token }}</h5>
    <div class="card-body" v-if="workflowState.state_by_task?.length == 0 && !workflowState.error_on_request">
      <h6 class="card-subtitle mb-2">
        There are no workflows connected to this token. Please use the following instructions to persist workflow
        metrics to this token.
      </h6>
      <div class="alert alert-dark">
        The following steps need to be taken:
        <ul>
          <li>Take a look at the current token - the full token is: <strong>{{ workflowState.token }}</strong>
          </li>
          <li>Start your nextflow workflow as you are used to. Just add the following command line arguments to
            the execution:
            <strong>{{ `-with-weblog http://localhost:8000/run/${workflowState.token}/` }}</strong>
          </li>
        </ul>
        So your command to execute will look similar to this: <br>
        <span class="text-muted">./nextflow run nextflow-io/elixir-workshop-21 -r master -with-docker -with-weblog
          http://localhost:8000/run/{{ workflowState.token }}</span>
        <br>
        As soon as the first metrics have been sent to the token-specific-endpoint, you will be able to see the
        progress here.
      </div>
    </div>
    <div class="card-body"
      v-if="workflowState.token_info_requested && workflowState.state_by_task?.length > 0 && !workflowState.error_on_request && workflowState.process_state">
      <h5 class="card-title">By process</h5>
      <hr>
      <div>
        <MultiSelect v-model="filterState.selectedProgressProcesses" :options="filterState.availableProcesses"
          v-on:update:model-value="progressProcessSelectionChanged()" showToggleAll filter placeholder="Select Processes"
          display="chip" class="w-full" />
        <!-- also check if this can be made better-->
        <div v-for="(info, process) in workflowState.filteredProcesses">
          <Panel :header="process" toggleable collapsed :pt="{
            header: { style: { 'max-height': '40px' } },
            root: { class: 'mt-1 mb-1' }
          }">
            <template #header>
              <div class="row">
                <strong>{{ process }}</strong>
                <!-- we want progress here https://primevue.org/datatable/#rowgroup_expandable -->
              </div>
            </template>

            <p class="m-0">
            <ul class="list-group list-group-flush">
              <li class="list-group-item" v-for="(task, id) in info['tasks']">
                <Tag :value="`#${id} - ${task['tag']}`"></Tag>
                <!-- get progress here-->
              </li>
            </ul>

            </p>
          </Panel>




        </div>
      </div>


      <hr>
      <div class="card-body">
        <h5 class="card-title">Trace Information</h5>

        <DataTable :value="workflowState.state_by_task" sortField="task_id" :sortOrder="1" v-model:filters="filters"
          filterDisplay="row" tableStyle="min-width: 50rem" paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]"
          removableSort>
          <Column field="task_id" header="Task-ID" sortable></Column>
          <Column field="name" style="min-width: 20rem" header="Name" sortable :show-filter-menu="false"
            filter-field="name">
            <template #body="{ data }">
              {{ data['name'] }}
            </template>
            <template #filter="{ filterModel, filterCallback }">
              <InputText v-model="filterModel.value" type="text" @input="filterCallback()" class="p-column-filter"
                placeholder="Filter name" />
            </template>
          </Column>
          <Column field="status" style="min-width: 12rem" header="Status" sortable filter-field="status"
            :show-filter-menu="false" :filter-match-mode="'contains'">
            <!-- adjust it to be a dropdown! -->
            <template #body="{ data }">
              <Tag :value="data['status']" />
            </template>
            <template #filter="{ filterModel, filterCallback }">
              <MultiSelect v-model="filterModel.value" style="max-width: 12rem" display="chip" @change="filterCallback()"
                :pt="{
                  token: {
                    style: { 'max-width': '8rem' }
                  },
                  tokenLabel: { style: { 'font-size': '10px' } }
                }" :options="STATUSES" placeholder="Any" class="p-column-filter">
                <template #header>

                </template>
                <template #option="slotProps">
                  <Tag :value="slotProps.option" />
                </template>
              </MultiSelect>
            </template>
          </Column>
          <Column field="process" header="Process" style="min-width: 20rem" sortable :show-filter-menu="false"
            filter-field="process">
            <template #filter="{ filterModel, filterCallback }">
              <InputText v-model="filterModel.value" type="text" @input="filterCallback()" class="p-column-filter"
                placeholder="Search by process" />
            </template>
          </Column>

          <Column field="tag" header="Tag" style="min-width: 20rem" filter-field="tag" :show-filter-menu="false" sortable>
            <template #filter="{ filterModel, filterCallback }">
              <InputText v-model="filterModel.value" type="text" @input="filterCallback()" class="p-column-filter"
                placeholder="Search by name" />
            </template>
          </Column>
          <Column field="timestamp" header="Timestamp" sortable></Column>
          <Column field="duration" sortable header="Duration">
            <template #body="{ data }">
              {{ (data['duration'] / 1000).toFixed(2) }} s
            </template>
          </Column>
          <Column field="cpu_percentage" header="CPU %" sortable></Column>
          <Column field="memory_percentage" header="Memory %" sortable></Column>
          <Column field="memory" header="Memory">
            <template #body="{ data }">
              {{ reasonableDataFormat(data['memory']) }}
            </template>
          </Column>
          <Column field="disk" header="Disk"></Column>
          <Column field="rchar" header="rchar" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data['rchar']) }}
            </template>
          </Column>
          <Column field="wchar" header="wchar" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data['wchar']) }}
            </template>
          </Column>
          <Column field="rss" header="rss" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data['rss']) }}
            </template>
          </Column>
          <Column field="peak_rss" header="Peak rss" sortable></Column>
          <Column field="syscr" header="syscr" sortable></Column>
          <Column field="syscw" header="syscw" sortable></Column>
          <Column field="peak_vmem" header="Peak VMem" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data['peak_vmem']) }}
            </template>
          </Column>
          <Column field="vmem" header="VMem" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data['vmem']) }}
            </template>
          </Column>
          <Column field="read_bytes" header="Read bytes" sortable></Column>
          <Column field="write_bytes" header="Written bytes" sortable>
          </Column>
          <Column field="vol_ctxt" header="Voluntary context switches" sortable></Column>
          <Column field="inv_ctxt" header="Involuntary cs" sortable></Column>
          <Column field="time" header="Time" sortable>
            <template #body="{ data }">
              {{ data['time'] / 1000 }} s
            </template>
          </Column>
          <Column field="realtime" header="Realtime" sortable>
            <template #body="{ data }">
              {{ (data['realtime'] / 1000) }} s
            </template>
          </Column>
        </DataTable>
      </div>
    </div>
    <div class="p-4 row-gap-3">
      <div>
        <h4>Metric visualization</h4>
      </div>
      <div class="card-body" v-if="filterState.selectedProcesses">
        <MultiSelect v-model="filterState.selectedProcesses" :options="filterState.availableProcesses"
          v-on:update:model-value="metricProcessSelectionChanged();" filter placeholder="Select Processes" display="chip"
          class="w-full" />
        <!-- check if we could push this to the datatable and have checkboxes instead?!-->
      </div>
      <div class="card-body" id="canvas_area">

      </div>
      <hr>
      <div class="card-body" v-if="workflowState.token_info_requested && !workflowState.error_on_request">
        <div type="button" class="btn btn-outline-danger" @click="deleteToken(workflowState.token)">
          Delete token
        </div>

      </div>
    </div>

    <div class="card-body" v-if="workflowState.error_on_request">
      <div class="alert alert-info">
        This token is not correct, please enter another token
      </div>
    </div>

  </div>
</template>

<style scoped></style>
