<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, toRaw } from "vue";
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap/dist/js/bootstrap.min.js"
import type { RunTrace } from "@/models/RunTrace";
import { useRouter, useRoute } from "vue-router";
import axios, { all } from "axios";
import { Chart, LinearScale, CategoryScale, TimeScale } from 'chart.js/auto'; // check vue-chartjs as wrapper
import { BoxPlotController, BoxAndWiskers } from '@sgratzl/chartjs-chart-boxplot';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import CascadeSelect from 'primevue/cascadeselect'; // could be used to show aprocess names as a "tree"
import Button from 'primevue/button';
import ToggleButton from 'primevue/togglebutton';
import Tag from 'primevue/tag';
import MultiSelect from "primevue/multiselect";
import { FilterMatchMode, FilterService } from 'primevue/api';
import InputText from 'primevue/inputtext';
import ProgressBar from 'primevue/progressbar';
import Message from 'primevue/message'; // could replace alerts
// import Skeleton from 'primevue/skeleton'; // while loading
// import ProgressSpinner from 'primevue/progressspinner'; // same
import Knob from 'primevue/knob';
import Panel from 'primevue/panel';
import ConfirmDialog from "primevue/confirmdialog";
import Toast from "primevue/toast";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import Listbox from "primevue/listbox";
import Process from "../models/Process"
import RadioButton from 'primevue/radiobutton';


Chart.register(BoxPlotController, BoxAndWiskers, LinearScale, CategoryScale);

const router = useRouter();
const route = useRoute();

const confirm = useConfirm();
const toast = useToast();

/** Dialog functions **/

function confirmDeletion(): void {
  confirm.require({
    message: `Do you want to delete the token ${workflowState.token}? This will also delete all data connected to this token!`,
    header: 'Delete confirmation',
    acceptClass: 'p-button-danger',
    accept: () => {
      deleteToken();
    },
    reject: () => {
      toast.add({ severity: 'warn', summary: 'Aborted', detail: 'You have aborted the deletion of the token.', life: 5000 });
    },
  });
}


/** end of dialog functions **/

/** filter Service **/






const props = defineProps<{
  token: string;
}>();

const STATUSES = ['SUBMITTED', 'RUNNING', 'COMPLETED', 'FAILED', 'ABORTED'];
const nonAutoUpdateStates = ["ABORTED", "COMPLETED", "FAILED"];
const filters = ref({
  'status': { value: null, matchMode: FilterMatchMode.IN },
  'name': { value: null, matchMode: FilterMatchMode.CONTAINS },
  'process': { value: null, matchMode: FilterMatchMode.CONTAINS },
  'tag': { value: null, matchMode: 'tagTableFilter', },
});
/** end of filterService **/

const workflowState = reactive<{
  currentState: any;
  progress: any;
  runningProcesses: any;
  processObjects: Process[];
  processesByRun: any;
  runStartMapping: any;
  selectedRun: string;
  failedProcesses: boolean;
  pollInterval: any;
  loading: boolean;
  token: string;
  token_info_requested: boolean;
  error_on_request: boolean;
  filteredProgressProcesses: any;
  selectedProcesses: string[];
  meta: any;
  //connection: WebSocket;
}>({
  currentState: {},
  progress: {
    "all": null,
    "submitted": null,
    "running": null,
    "failed": null,
    "completed": null,
    "aborted": null
  },
  runningProcesses: {},
  processObjects: [],
  processesByRun: {},
  runStartMapping: {},
  selectedRun: '',
  failedProcesses: false,
  pollInterval: null,
  loading: true,
  token: "",
  token_info_requested: false,
  error_on_request: false,
  filteredProgressProcesses: {},
  selectedProcesses: [],
  meta: {},
  //connection: null,
});

const metricCharts = reactive<{
  chartsGenerated: boolean;
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
  chartsGenerated: false,
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
  selectedMetricProcesses: string[];
  autoselectAllMetricProcesses: boolean;
  selectedProgressProcesses: string[];
  autoselectAllProgressProcesses: boolean;
  autoselectAllMetricTags: boolean;
  selectedTags: string[];
  processTaskMapping: any;

}>({
  availableProcesses: [],
  availableTags: [],
  selectedMetricProcesses: [],
  autoselectAllMetricProcesses: true,
  selectedProgressProcesses: [],
  autoselectAllProgressProcesses: true,
  autoselectAllMetricTags: true,
  selectedTags: [],
  processTaskMapping: {},

});

/** functions on init and polling */

function getDataInitial(token = props.token): void {
  if (token.length > 0) {
    workflowState.loading = true;
    axios.get(`http://localhost:8000/run/${token}/`).then(
      response => {
        if (response.data["error"]) {
          workflowState.processObjects = [];
          workflowState.error_on_request = true;
        } else {
          workflowState.meta = response.data["result_meta"];
          workflowState.processesByRun = createProcessObjectsByRun(response.data["result_by_run_name"]);
          updateRunStartMapping();
          setFirstRunName();
          workflowState.processObjects = workflowState.processesByRun[workflowState.selectedRun];
          workflowState.runningProcesses = getRunningProcesses();
          updateCurrentState();
          updateProgress();
          workflowState.token_info_requested = true;
          workflowState.token = token;
          workflowState.error_on_request = false;
          updateFilterState();
          progressProcessSelectionChanged();
          // refactoring
          if (currentlySelectedWorkflowHasPlottableData()) {
            createPlots();
          }
          startPollingLoop();
        }
      },
    );
    /*
    workflowState.connection = new WebSocket(`wss://localhost:8000/run/${token}`);
    workflowState.connection. TODO: add websocket stuff
      */

  }

}

function destroyPollTimer(): void {
  clearInterval(workflowState.pollInterval);
}

function startPollingLoop(): void {
  if (!nonAutoUpdateStates.includes(workflowState.currentState)) {
    if (!workflowState.pollInterval) {
      workflowState.pollInterval = setInterval(dataPollingLoop, 7500);
    }
  }

}

function dataPollingLoop(): void {
  axios.get(`http://localhost:8000/run/${workflowState.token}/`).then(
    response => {
      if (response.data["error"]) {
        workflowState.error_on_request = true;

      } else {
        workflowState.meta = response.data["result_meta"];
        workflowState.runningProcesses = getRunningProcesses();
        workflowState.processesByRun = createProcessObjectsByRun(response.data["result_by_run_name"]);
        updateRunStartMapping();
        workflowState.processObjects = workflowState.processesByRun[workflowState.selectedRun];
        workflowState.runningProcesses = getRunningProcesses();
        updateCurrentState();
        updateProgress();
        workflowState.error_on_request = false;
        updateAvailableProcessNamesForFilter();
        updateAvailableTags();
        updateIfAutoselectEnabled();
        progressProcessSelectionChanged();
        updateIfTagAutoSelectEnabled();
        if (currentlySelectedWorkflowHasPlottableData()) {  
          if (metricCharts.chartsGenerated) {
            updatePlots();
          } else {
            createPlots();
          }
        }

      }
    });
}

/** end of init and polling */

/**
 * filter state functions
 */

function updateFilterState(): void {
  updateAvailableProcessNamesForFilter();
  updateAvailableTags();
  setSelectedProgressProcesses(filterState.availableProcesses);
  setSelectedMetricProcesses(filterState.availableProcesses);
  setSelectedMetricTags(filterState.availableTags);
}

function updateAvailableProcessNamesForFilter(): void {
  filterState.availableProcesses = getProcessNamesOnly();
}

function updateAvailableTags(): void {
  filterState.availableTags = getTags();
}

function getTags(): any[] {
  let tags: any[] = [];
  const task_states: Process[] = toRaw(workflowState.processObjects);
  if (task_states) {
    for (let task of task_states) {
      if (task.tag !== null) {
        let retrievedTags: any[] = task.tag;
        for (let pair of retrievedTags) {
          let tempKey: string = Object.keys(pair)[0];
          if (!tags.some(item => item[tempKey] === pair[tempKey])) {
            tags.push(pair);
          }
        }
      }
    }
  }
  
  return tags;
}

function checkTagMatch(tag: any, processTags: any): boolean {
  return processTags.some((item: any) => checkKeyValuePairing(item, tag));
}

function checkKeyValuePairing(item: any, tag: any): boolean {
  if (Object.keys(tag)[0] === Object.keys(item)[0]) {
    return tag[Object.keys(tag)[0]] === item[Object.keys(item)[0]];
  }
  return false;
}

function setSelectedMetricProcesses(processes: any[]): void {
  filterState.selectedMetricProcesses = processes;
}

function setSelectedMetricTags(tags: any[]): void {
  filterState.selectedTags = tags;
}

function setSelectedProgressProcesses(processes: any[]): void {
  filterState.selectedProgressProcesses = processes;
}

function selectAllMetricProcesses(): void {
  updateAvailableProcessNamesForFilter();
  setSelectedMetricProcesses(filterState.availableProcesses);
  metricProcessSelectionChanged();
}

function unselectAllMetricProcesses(): void {
  setSelectedMetricProcesses([]);
  metricProcessSelectionChanged();
}

function unselectAllMetricTags(): void {
  setSelectedMetricTags([]);
  metricTagSelectionChanged();
}

function selectAllMetricTags(): void {
  setSelectedMetricTags(filterState.availableTags);
  metricTagSelectionChanged();
}

function selectAllProgressProcesses(): void {
  updateAvailableProcessNamesForFilter();
  setSelectedProgressProcesses(filterState.availableProcesses);
  progressProcessSelectionChanged();
}

function unselectAllProgressProcesses(): void {
  setSelectedProgressProcesses([]);
  progressProcessSelectionChanged();
}

function updateIfTagAutoSelectEnabled(): void {
  if (filterState.autoselectAllMetricTags) {
    selectAllMetricTags();
  }
}

function updateIfAutoselectEnabled(): void {
  if (filterState.autoselectAllProgressProcesses) {
    selectAllProgressProcesses();
  }
  if (filterState.autoselectAllMetricProcesses) {
    selectAllMetricProcesses();
  }
}

function updateFilteredProgressProcesses(all: boolean = false): void {
  let filtered: any = {};
  if (all) {
    filterState.selectedProgressProcesses = toRaw(filterState.availableProcesses);
  }
  if (workflowState.processObjects) {
    for (let process of workflowState.processObjects) {
      if (filterState.selectedProgressProcesses.some(obj => obj['name'] === process.process)) {
        filtered[process.process] = process;
      }
    }
  }
  
  workflowState.filteredProgressProcesses = filtered;
}


function progressProcessSelectionChanged(): void {
  updateFilteredProgressProcesses();
}

function metricProcessSelectionChanged(): void {
  if (filterState.selectedMetricProcesses.length > 0 && metricCharts.chartsGenerated) {
    updatePlots();
  }
}

function metricTagSelectionChanged(): void {
  updatePlots();
}



function metricProcessAutoSelectionChanged(): void {
  if (filterState.autoselectAllMetricProcesses && !nonAutoUpdateStates.includes(workflowState.currentState[workflowState.selectedRun])) {
    selectAllMetricProcesses();
  } else {
    // what to do here?
  }
}

function metricTagAutoSelectionChanged(): void {
  if (filterState.autoselectAllMetricTags && !nonAutoUpdateStates.includes(workflowState.currentState[workflowState.selectedRun])) {
    selectAllMetricTags();
  }
}

function progressProcessAutoSelectionChanged(): void {
  if (filterState.autoselectAllProgressProcesses && !nonAutoUpdateStates.includes(workflowState.currentState[workflowState.selectedRun])) {
    updateFilteredProgressProcesses(true);
  } else {
    // what to do here?
  }
}

function hideAutoUpdateEnableOptionMetric(): boolean {
  return !(nonAutoUpdateStates.includes(workflowState.currentState[workflowState.selectedRun]) && filterState.autoselectAllMetricProcesses);
}

function hideAutoUpdateEnableOptionProgress(): boolean {
  return !(nonAutoUpdateStates.includes(workflowState.currentState[workflowState.selectedRun]) && filterState.autoselectAllProgressProcesses);
}

function hideAutoUpdateEnableOptionTags(): boolean {
  return !(nonAutoUpdateStates.includes(workflowState.currentState[workflowState.selectedRun]) && filterState.autoselectAllMetricTags);
}


/** end of filter state functions */

/** Plot creation **/

async function createPlots() {
  await delay(300);
  createRamPlot();
  createRelativeRamPlot();
  createCPUPlot();
  createIOPlot();
  createDurationPlot();
  metricCharts.chartsGenerated = true;
}

/* TODO: REFACTOR regarding asynchron
*/
function generateDiv(elementId: string, title: string): HTMLCanvasElement {
  const divWithCanvas = document.createElement('div');
  const titleElement = document.createElement('h5');
  titleElement.textContent = title;
  divWithCanvas.style.width = '80vw';
  const canvas = document.createElement('canvas');
  canvas.id = elementId;
  canvas.classList.add("p-4")
  divWithCanvas.appendChild(titleElement);
  divWithCanvas.appendChild(canvas);
  const targetDiv = document.getElementById('canvas_area');
  if (targetDiv !== null) {
    targetDiv.appendChild(divWithCanvas);
  }
  return canvas;
  
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

}

/** End of Plot creation */

/** Plot updating **/

function updatePlots() {
  if (currentlySelectedWorkflowHasPlottableData()) {
    updateRamPlot();
    updateRelativeRamPlot();
    updateCPUPlot();
    updateIOPlot();
    updateDurationPlot();
  }
 
}

function updateIOPlot() {
  let generatedDatasets: [string[], any[]] = generateDataByMultipleKeys(
    ['read_bytes', 'write_bytes'],
    true,
    'MiB',
    ['Read in ', 'Written in '],
    filterState.selectedMetricProcesses
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
    filterState.selectedMetricProcesses,
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
  // there is a bug somewhere, which leads to wrong calculation of datasets on filter change
}

function updateRelativeRamPlot() {
  let generatedDatasets: [string[], any[]] = generateMemoryRelativeData();
  metricCharts.relativeMemoryChart.data.labels = getSuffixes(generatedDatasets[0]);
  metricCharts.relativeMemoryChart.data.datasets = generatedDatasets[1];
  metricCharts.relativeMemoryChart.update('none');
}

/** end of plot updating */


/** helper functions */



/**
* openai: chatgpt - prompt: in javascript, take a list of strings, which can be splitted using the character ':'.
how to write a function, which returns the suffixes of those strings, where the prefix of the word is removed, which is the same for all strings in the list
___
needs to be adjusted - returns 'owtie:Aling' and so on, instead of removing the bowtie part or do we want to keep the whole bowtie stuff? check this again
result:
*/

function currentlySelectedWorkflowHasPlottableData(): boolean {
  if (workflowState.selectedRun !== '') {
    return workflowState.currentState[workflowState.selectedRun] && workflowState.currentState[workflowState.selectedRun] !== "WAITING";
  }
  return false;
  
}

/* even if unused, keep */
function createProcessObjects(data: any[]): Process[] {
  let processes: Process[] = [];
  for (let object of data) {
    let process = new Process(object);
    processes.push(process);
  }
  return processes;
}

/*
Openai: prompt: how to use the date class in vuejs to format date in html, also considering the time
*/
function formattedDate(date: Date): string {
  const options: any = {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'};
  return new Intl.DateTimeFormat('de-DE', options).format(date);
}

function adjustSelectedRun(): void {
  workflowState.processObjects = workflowState.processesByRun[workflowState.selectedRun];
  updateFilterState()
  updateFilteredProgressProcesses();
  updateCurrentState();
  updateProgress();
  if (currentlySelectedWorkflowHasPlottableData()) {
    updatePlots();
  }
}
  


function createProcessObjectsByRun(data: any): any {
  data = toRaw(data);
  let grouped: any = {};
  for (let key in data) {
    grouped[key] = [];
    for (let process of data[key]) {
      grouped[key].push(new Process(process));
    }
  }
  return grouped;
}

function setFirstRunName(): void {
  if (Object.keys(workflowState.processesByRun).length > 0) {
    workflowState.selectedRun = Object.keys(workflowState.processesByRun)[0];
  } else {
    workflowState.selectedRun = '';
  }
}

function updateRunStartMapping(): void {
  let result: any = {};
  const metaObjects: any = toRaw(workflowState.meta);
  if (Object.keys(metaObjects).length > 0) {
    for (let meta of metaObjects) {
      if (!(meta["run_name"] in result)) {
        result[meta["run_name"]] = null;
        if (meta["event"] === "started") {
          result[meta["run_name"]] = new Date(meta["timestamp"]);
        }
      }
    }
  }
  workflowState.runStartMapping = result;
  

}

function startBackToMainTimer(): void {
  destroyPollTimer();
  setTimeout(() => {
    router.push("/");
  }, 5000);
}

function updateCurrentState(): void {
  let full_meta: any[] = toRaw(workflowState.meta);
  let processes = toRaw(workflowState.processObjects);
  for (let name in workflowState.runStartMapping) {
    let meta: any[] = full_meta.filter((metaOb: any) => metaOb["run_name"] === name);
    meta = meta.reduce((latestMeta: any, currMeta: any) => {
    if (new Date(latestMeta["timestamp"]) > new Date(currMeta["timestamp"])) {
      return latestMeta;
    } else {
      return currMeta;
    }
  }); 
  adjustCurrentStateForRun(name, meta);
  }
  if (processes) {
    for (let process of processes) {
      if (process.status === "FAILED") {
        workflowState.failedProcesses = true;
        return;
      }
    }
  }
  workflowState.failedProcesses = false;
}


function updateProgress(): void {
  const allProcesses = toRaw(workflowState.processObjects);
  let all: number = 0;
  let submitted: number = 0
  let running: number = 0;
  let completed: number = 0;
  let failed: number = 0;
  let aborted: number = 0;
  if (allProcesses) {
    for (let process of allProcesses) {
      switch (process.status) {
        case "SUBMITTED":
          submitted += 1;
          break;
        case "RUNNING":
          running += 1;
          break;
        case "FAILED":
          failed += 1;
          break;
        case "ABORTED":
          aborted += 1;
          break;
        case "COMPLETED":
          completed += 1;
          break;
      }
      all += 1;
    }
  }
  
  workflowState.progress = {
    "all": all,
    "submitted": submitted,
    "running": running,
    "failed": failed,
    "completed": completed,
    "aborted": aborted
  }

}


function adjustCurrentStateForRun(nameKey: string, meta: any) {
  if (meta['event'] === "started") {
    let processes: Process[] = toRaw(workflowState.processObjects);
    if (workflowState.currentState[nameKey] === "SUBMITTED" || workflowState.currentState[nameKey] === "WAITING") {
      for (let process of processes) {
        if (process.status == "RUNNING") {
          workflowState.currentState[nameKey] = "RUNNING";
          return
        } else if (process.status == "COMPLETED") {
          workflowState.currentState[nameKey] = "RUNNING";
          return;
        }
      }
      workflowState.currentState = "SUBMITTED";
    }
  } else if (meta['event'] === "completed") {
    if (meta["error_message"] !== null) {

      if (meta["error_message"] === "SIGINT") {
        workflowState.currentState[nameKey] = "ABORTED";
      } else {
        workflowState.currentState[nameKey] = "FAILED";
      }
    } else {
      workflowState.currentState[nameKey] = "COMPLETED";
    }
  }
  // todo: refactor - needs to consider all
  if (nonAutoUpdateStates.includes(workflowState.currentState[nameKey])) {
    destroyPollTimer();
  }
}

/** needs refactoring due to new structure! **/
function getRunningProcesses(): any {
  let processes: any = {};
  const allProcesses = toRaw(workflowState.processObjects);
  if (allProcesses) {
    for (let process of allProcesses) {
      if (process.status === "RUNNING") {
        if (!(process.process in processes)) {
          processes[process.process] = [process]
        } else {
          processes[process.process].push(process);
        }
      }
    }
  }
  
  return processes;
}

function severityFromWorkflowState(): string {
  const state: string = workflowState.currentState[workflowState.selectedRun];
  switch (state) {
    case "SUBMITTED":
      return "info"
    case "RUNNING":
      return "info"
    case "FAILED":
      return "error";
    case "ABORTED":
      return "warn";
    case "COMPLETED":
      return "success";
    default:
      return "info"
  }
}

function messageFromWorkflowState(): string {
  const state: string = workflowState.currentState[workflowState.selectedRun];
  switch (state) {
    case "SUBMITTED":
      return `The workflow run ${workflowState.selectedRun} was submitted, but no process has started yet`;
    case "RUNNING":
      return `The workflow run  ${workflowState.selectedRun} is currently running`;
    case "FAILED":
      return `Your workflow run ${workflowState.selectedRun} has failed!`;
    case "ABORTED":
      return `Your worfklow run ${workflowState.selectedRun} has been aborted!`;
    case "COMPLETED":
      return `Your workflow run ${workflowState.selectedRun} has been successfully completed!`;
    default:
      return "There is no information to show yet. You may need to start a workflow or select a workflow run."
  }
}

function getSuffixes(strings: string[]) {
  return strings.map(str => {
    const parts = str.split(':');
    return parts[parts.length - 1];
  });
}

function getSuffix(str: string) {
  const parts: string[] = str.split(":");

  return parts[parts.length - 1];
}

function getProcessNamesOnly(): any[] {
  mapAvailableProcesses();
  let state: any = toRaw(filterState.processTaskMapping);
  let keys: string[] = Object.keys(state);
  return keys.map(name => ({ name }));
}

function mapAvailableProcesses(): void {
  let result: any = {};
  let state: any = toRaw(workflowState.processObjects);
  if (state) {
    for (let process of state) {
      if (!(process.process in result)) {
        result[process.process] = [result.task_id]
      } else {
        result[process.process].push(result.task_id);
      }
    }
  }
  
  filterState.processTaskMapping = result;
}

function processNumbers(process: Process): string {
  process = toRaw(process);
  const currently_submitted: number = getNumberOfTasksForProcess(process.process);
  const completed: number = getNumberOfCompletedSubprocesses(process.process);
  return `${completed} / ${currently_submitted}`;
}

function getNumberOfTasksForProcess(processName: string): number {
  const allProcesses = toRaw(workflowState.processObjects);
  const processesByName: Process[] = allProcesses.filter((process: Process) => process.process === processName);
  return processesByName.length;
}

function getNumberOfCompletedSubprocesses(processName: string): number {
  const allProcesses = toRaw(workflowState.processObjects);
  const completedProcessesByName: Process[] = allProcesses.filter((process: Process) => process.process === processName && process.status === "COMPLETED");
  return completedProcessesByName.length;
}

function generateColorString(status: string): string {
  switch (status) {
    case 'SUBMITTED':
      return 'var(--cyan-300)';
    case 'ABORTED':
      return 'var(--orange-400)';
    case 'FAILED':
      return 'var(--red-600)';
    case 'RUNNING':
      return 'var(--teal-400)';
    case 'COMPLETED':
      return 'var(--green-600)';
    default:
      return 'var(--teal-50)';
  }
}

function getProgressValueForTask(status: string): number {

  switch (status) {
    case 'SUBMITTED':
      return 10;
    case 'ABORTED':
      return 30;
    case 'FAILED':
      return 20;
    case 'RUNNING':
      return 50;
    case 'COMPLETED':
      return 100;
    default:
      return 0;
  }

}


function deleteToken() {
  axios.delete(`http://localhost:8000/token/remove/${workflowState.token}/`).then(
    response => {
      if (response.data["deleted"]) {
        toast.add({ severity: 'error', summary: 'Confirmed', detail: 'You have successfully deleted this token and all connected information. You will be redirected to the main-page.', life: 5000 });
        startBackToMainTimer();
      } else {
        toast.add({ severity: 'warn', summary: 'Failed', detail: 'Te deletion of the token has failed. Please try again!', life: 5000 });
      }
    }).finally(
      () => {
        return false;
      }
    );

}


function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



function reasonableDataFormat(input: number) {
  const types: string[] = ['b', 'kiB', 'MiB', 'GiB', 'TiB'];
  let iteration: number = 0;
  if (input) {
    while (input >= 1024 && iteration < types.length) {
      input = input / 1024;
      iteration += 1;
    }
    return `${input.toFixed(3)} ${types[iteration]}`;
  } else {
    return "";
  }

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

/** end of helper functions */

/** data retrieval functions */

function generateSummarizedDataByKey(key: string, factorizer: number = 1): any {
  let data_pair: any = {};
  let processDataMapping: any = {};
  let tagFilter: boolean = false;
  let selectedTags: any = [];
  let processesToFilterBy: any[] = toRaw(filterState.selectedMetricProcesses);
  if (filterState.selectedTags.length > 0 && filterState.selectedTags.length !== filterState.availableTags.length) {
    tagFilter = true;
    selectedTags = toRaw(filterState.selectedTags);
  }
  let states: any = toRaw(workflowState.processObjects);
  for (let process of states) {
    if (tagFilter) {
      if (!selectedTags.some(tag => checkTagMatch(tag, process.tag))) {
        continue;
      }
    }
    if (processesToFilterBy.some(obj => obj['name'] === process.process)) {
      if (!(process.process in processDataMapping)) {
        processDataMapping[process.process] = [process[key]];
      } else {
        processDataMapping[process.process].push(process[key]);
      }

    }
  }

  for (let processMap in processDataMapping) {
    if (factorizer !== 1) {
      processDataMapping[processMap] = processDataMapping[processMap].map((elem: number) => elem / factorizer);
    }
    processDataMapping[processMap] = processDataMapping[processMap].reduce((a: number, b: number) => a + b, 0);

  }

  data_pair["data"] = Object.values(processDataMapping);
  data_pair["labels"] = Object.keys(processDataMapping);
  data_pair['maxBarThickness'] = 30;
  return data_pair;
}

function generateDataByKey(key: string, adjustFormat: boolean, wantedFormat: string): any {
  let data_pair: any = {};
  let processDataMapping: any = {};
  let processesToFilterBy: any[] = toRaw(filterState.selectedMetricProcesses);
  let tagFilter: boolean = false;
  let selectedTags: any[] = [];
  if (filterState.selectedTags.length > 0 && filterState.selectedTags.length !== filterState.availableTags.length) {
    tagFilter = true;
    selectedTags = toRaw(filterState.selectedTags);
  }
  let states: any = toRaw(workflowState.processObjects);
  for (let process of states) {
    if (tagFilter) {
      if (!selectedTags.some(tag => checkTagMatch(tag, process.tag))) {
        continue;
      }
    }
    if (processesToFilterBy.some(obj => obj['name'] === process.process)) {
      if (!(process.process in processDataMapping)) {
        processDataMapping[process.process] = [process[key]]
      } else {
        processDataMapping[process.process].push(process[key]);
      }
    }
  }
  let temporaryValues: any[] = Object.values(processDataMapping);
  if (adjustFormat) {
    temporaryValues = temporaryValues.map((lst: any[]) => getDataInValidFormat(lst, wantedFormat)[0]);
  }

  data_pair["data"] = temporaryValues;
  data_pair["labels"] = Object.keys(processDataMapping);
  data_pair['type'] = wantedFormat;
  data_pair['maxBarThickness'] = 30;
  return data_pair;
}

function generateDataByMultipleKeys(keys: string[], adjust: boolean, wantedFormat: string, label: string[], processFilter: string[] = []): any {
  let processNames: string[] = [];
  let datasets: any[] = [];
  let tagFilter: boolean = false;
  let selectedTags: any[] = [];
  if (filterState.selectedTags.length > 0 && filterState.selectedTags.length !== filterState.availableTags.length) {
    tagFilter = true;
    selectedTags = toRaw(filterState.selectedTags);
  }
  let states: any = toRaw(workflowState.processObjects);
  let key_index = 0;
  let processesToFilterBy: any[] = toRaw(processFilter);
  for (let key of keys) {
    let processDataMapping: any = {};
    let single_dataset: any = { 'label': label[key_index] + wantedFormat, data: [] };
    for (let process of states) {
      if (tagFilter) {
        if (!selectedTags.some(tag => checkTagMatch(tag, process.tag))) {
          continue;
        }
      }
      if (processesToFilterBy.some(obj => obj['name'] === process.process)) {
        if (!(process.process in processDataMapping)) {
          processDataMapping[process.process] = [process[key]];
        } else {
          processDataMapping[process.process].push(process[key]);
        }

      }
    }
    processNames = Object.keys(processDataMapping);
    if (adjust) {
      single_dataset['data'] = Object.values(processDataMapping).map((lst: number[]) => getDataInValidFormat(lst, wantedFormat)[0]);
    } else {
      single_dataset['data'] = Object.values(processDataMapping);
    }

    single_dataset['maxBarThickness'] = 30;
    datasets.push(single_dataset);
    key_index += 1;
  }
  return [processNames, datasets];
}

/** this could be more general? **/

function generateMemoryRelativeData(): [string[], any[]] {
  let datasets: any[] = [];
  let selectedTags: any = [];
  let tagFilter: boolean = false;
  const processesToFilterBy: any[] = toRaw(filterState.selectedMetricProcesses)
  if (filterState.selectedTags.length > 0 && filterState.selectedTags.length !== filterState.availableTags.length) {
    tagFilter = true;
    selectedTags = toRaw(filterState.selectedTags);
  }
  let states: any = toRaw(workflowState.processObjects);
  let processDataMapping: any = {};
  let relative_dataset: any = { 'label': 'Memory usage in %', 'data': [] }
  for (let process of states) {
    if (tagFilter) {
      if (!selectedTags.some((tag: any) => checkTagMatch(tag, process.tag))) {
        continue;
      }
    }
    if (processesToFilterBy.some(obj => obj['name'] === process.process)) {
      if (!(process.process in processDataMapping)) {
        processDataMapping[process.process] = [(process.rss / process.memory) * 100];
      } else {
        processDataMapping[process.process].push((process.rss / process.memory) * 100);
      }
    }
  }
  relative_dataset['data'] = Object.values(processDataMapping);
  relative_dataset['maxBarThickness'] = 30;
  datasets.push(relative_dataset);
  return [Object.keys(processDataMapping), datasets];

}


function generateKeyRelativeData(dataKey: string, respectToKey: string, label: string, factor: number = 100): [string[], any[]] {
  let datasets: any[] = [];
  let states: any = toRaw(workflowState.processObjects);
  let processDataMapping: any = {}
  let tagFilter: boolean = false;
  let selectedTags: any[] = [];
  let processesToFilterBy: any[] = toRaw(filterState.selectedMetricProcesses);
  if (filterState.selectedTags.length > 0 && filterState.selectedTags.length !== filterState.availableTags.length) {
    tagFilter = true;
    selectedTags = toRaw(filterState.selectedTags);
  }
  let relative_dataset: any = { 'label': label, 'data': [] }
  for (let process of states) {
    if (tagFilter) {
      if (!selectedTags.some(tag => checkTagMatch(tag, process.tag))) {
        continue;
      }
      if (processesToFilterBy.some(obj => obj['name'] === process.process)) {
        if (!(process.process in processDataMapping)) {
          processDataMapping[process.process] = [(process[dataKey] / process[respectToKey]) * factor];
        } else {
          processDataMapping[process.process].push((process[dataKey] / process[respectToKey]) * factor)
        }
      }
    }

  }
  relative_dataset['maxBarThickness'] = 30;
  relative_dataset['data'] = Object.values(processDataMapping);
  datasets.push(relative_dataset);
  return [Object.keys(processDataMapping), datasets];
}

function generateCPUData(): [string[], any[]] {
  let datasets: any[] = [];
  let selectedTags: any[] = [];
  let tagFilter: boolean = false;
  const processesToFilterBy: any[] = toRaw(filterState.selectedMetricProcesses);
  if (filterState.selectedTags.length > 0 && filterState.selectedTags.length !== filterState.availableTags.length) {
    tagFilter = true;
    selectedTags = toRaw(filterState.selectedTags);
  }
  let states: any = toRaw(workflowState.processObjects);

  let processDataMapping: any = {};

  for (let process of states) {
    if (tagFilter) {
      if (!selectedTags.some((tag: any) => checkTagMatch(tag, process.tag))) {
        continue;
      }
    }
    if (processesToFilterBy.some(obj => obj['name'] === process.process)) {
      if (!(process.process in processDataMapping)) {
        processDataMapping[process.process] = { 'cpus': [process.cpus], 'realtime': [process.realtime] }
      } else {
        let allocationValues = processDataMapping[process.process];
        allocationValues['cpus'].push(process.cpus);
        allocationValues['realtime'].push(process.realtime);
        processDataMapping[process.process] = allocationValues;
      }
    }
  }

  let allocation_data = [];
  let raw_usage_data = [];
  for (let process in processDataMapping) {
    let value_numerator: number = 0;
    let value_denominator: number = 0;
    let values_raw: number[] = [];
    let idx: number = 0;
    while (idx < processDataMapping[process]['cpus'].length) {
      value_numerator += processDataMapping[process]['cpus'][idx] * (processDataMapping[process]['realtime'][idx] / 1000)
      value_denominator += (processDataMapping[process]['realtime'][idx] / 1000);
      values_raw.push(processDataMapping[process]['cpus'][idx] * 100)
      idx += 1;
    }
    let value: number = 0;
    if (value_denominator > 0) {
      value = value_numerator / value_denominator;
    }

    allocation_data.push([value * 100]);
    raw_usage_data.push(values_raw);
  }
  datasets.push({ 'label': 'Requested CPU used in %', 'data': allocation_data, 'maxBarThickness': 30 })
  datasets.push({ 'label': 'CPU usage in %', 'data': raw_usage_data, 'maxBarThickness': 30 });

  return [Object.keys(processDataMapping), datasets]
}

function generateDurationData(): [string[], any[]] {
  let data_sum = generateSummarizedDataByKey('duration', 1000);
  let data_exec = generateDataByKey('realtime', false, 's');
  let data_execution: any[] = [];
  data_exec['data'].forEach((element: any[]) => {
    let mapped: any[] = element.map((value) => value / 1000);
    data_execution.push(mapped);
  });
  let data_allocated = generateKeyRelativeData('realtime', 'time', 'Requested time used in %', 100)[1];

  let datasets: any[] =
    [
      {
        type: 'bar',
        label: `Summarized Duration in seconds`,
        data: data_sum["data"],
        'maxBarThickness': 30,
      },
      {
        type: 'boxplot',
        label: 'Execution in real-time',
        data: data_execution,
        'maxBarThickness': 30,
      },
      {
        type: 'boxplot',
        label: 'Requested time used in %',
        data: data_allocated[1],
        'maxBarThickness': 30,
      }
    ];
  return [getSuffixes(data_exec["labels"]), datasets];


}


/** end of data retrieval functions */

/* on mounted */

onMounted(() => {
  FilterService.register('tagTableFilter', (value, filter): boolean => {
    filter = toRaw(filter);
    value = toRaw(value);
    
    if (filter === null) {
      return true;
    }
    
    let valueTags: any[] = [];

    for (let val of value) {
      valueTags.push(val);
    }

    let filterTags: any[] = [];
    
    for (let fil of filter) {
      filterTags.push(toRaw(fil));
    }

    const commonObjects = filterTags.filter((filObj: any) => valueTags.some((valueObj: any) => {
      return Object.keys(filObj)[0] === Object.keys(valueObj)[0] && Object.values(filObj)[0] === Object.values(valueObj)[0]; 
    }))

    return commonObjects.length > 0;
  });
  getDataInitial();
});

onUnmounted(() => {
  destroyPollTimer();
})

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
   
    <div class="card-body m-4" v-if="workflowState.token && Object.keys(workflowState.processesByRun).length > 0">
      <h6 class=card-title>Runs</h6>
      <div class="row flex flex-wrap m-2"  v-for="key in Object.keys(workflowState.processesByRun)">
        <div class="flex col-auto align-items-center">
            <RadioButton v-model="workflowState.selectedRun"  v-on:update:model-value="adjustSelectedRun()"  :input-id="key" :value="key" />
            <label :for="key" class="ms-2">
              {{key}} - {{ workflowState.runStartMapping[key] ? ' started at ' + formattedDate(workflowState.runStartMapping[key]) : 'no start-date available'}}
            </label>
        </div>
    </div>
    </div>
    <div class="card-body m-4"
      v-if="workflowState.selectedRun === ''">
      <div v-if="!(Object.keys(workflowState.runStartMapping).length > 0)">
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
    <div v-else>
      <Message :closable="false">
        Please select a workflow run above
      </Message>
    </div>
     
    </div>
    <div class="card-body mb-4">
      <Message v-if="currentlySelectedWorkflowHasPlottableData()" :closable="false" :severity="severityFromWorkflowState()">
        {{ messageFromWorkflowState() }}</Message>
      <Message v-if="workflowState.failedProcesses" severity="warn">There are processes, which failed during execution of
        the workflow!</Message>
    </div>
    <div class="card-body mb-4" v-if="currentlySelectedWorkflowHasPlottableData()">
      <h5 class="card-title">Progress</h5>
      <hr>
      <div>
        <div class="mb-4">
          <div class="row justify-content-center">
            <ProgressBar v-if="workflowState.progress['all'] > 0" class="mt-2" :showValue="false"
              style="height: 3px; max-width: 70vw;"
              :value="(workflowState.progress['completed'] / workflowState.progress['all']) * 100">
            </ProgressBar>
          </div>
          <div class="row justify-content-center">
            {{ workflowState.progress['completed'] }} of {{ workflowState.progress['all'] }} processes completed
          </div>

        </div>
        <div class="row">
          <div class="col-3">
            <Knob v-if="workflowState.progress['all'] > 0" :min="0" :max="workflowState.progress['all']"
              v-model="workflowState.progress['submitted']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center">Submitted</span>
          </div>
          <div class="col-3">
            <Knob v-if="workflowState.progress['all'] > 0" :min="0" :max="workflowState.progress['all']"
              v-model="workflowState.progress['running']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center">Running</span>
          </div>
          <div class="col-3">
            <Knob v-if="workflowState.progress['all'] > 0" :min="0" :max="workflowState.progress['all']"
              valueColor="Green" v-model="workflowState.progress['completed']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center">Completed</span>
          </div>
          <div class="col-3">
            <Knob v-if="workflowState.progress['all'] > 0" :min="0" :max="workflowState.progress['all']" valueColor="Red"
              v-model="workflowState.progress['failed']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center">Failed</span>
          </div>
        </div>
      </div>
    </div>
    <div class="card-body mb-4" v-if="workflowState.runningProcesses.length > 0">
      <h5 class="card-title">Currently running</h5>
      <hr>
      <div v-for="(info, process) in workflowState.runningProcesses">
        <strong>{{ process }}</strong> - {{ Object.keys(info["tasks"]).length > 1 ?
          Object.keys(info["tasks"]).length + 'processes' : '1 process' }} with tags : <Tag
          v-for="(task, id) in info['tasks']" :value="task['tag']"></Tag>
      </div>
    </div>

    <div class="card-body"
      v-if="workflowState.token_info_requested && workflowState.processObjects?.length > 0 && !workflowState.error_on_request">
      <h5 class="card-title">By process</h5>
      <hr>
      <div>
        <div class="row">
          <div class="col-6">
            <MultiSelect v-model="filterState.selectedProgressProcesses" :options="filterState.availableProcesses"
              :disabled="filterState.autoselectAllProgressProcesses"
              v-on:update:model-value="progressProcessSelectionChanged()" :showToggleAll="false" filter
              placeholder="Select Processes" optionLabel="name" display="chip" class="md:w-20rem"
              style="max-width: 40vw" />
          </div>
          <div class="col-3">
            <Button :disabled="filterState.autoselectAllProgressProcesses" v-on:click="unselectAllProgressProcesses()"
              label="Deselect all" />
            <Button :disabled="filterState.autoselectAllProgressProcesses" v-on:click="selectAllProgressProcesses()"
              label="Select all" />
          </div>
          <div class="col-3">
            <ToggleButton v-model="filterState.autoselectAllProgressProcesses"
              v-on:change="progressProcessAutoSelectionChanged()" onLabel="Autoupdate enabled"
              offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionProgress()" onIcon="pi pi-check"
              offIcon="pi pi-times" /> <!-- need function to handle this -->
          </div>
        </div>
        <!-- also check if this can be made better-->
        <div v-for="(info, process) in workflowState.filteredProgressProcesses">
          <Panel :header="process.toString()" toggleable collapsed :pt="{
            header: { style: { 'max-height': '40px' } },
            root: { class: 'mt-1 mb-1' }
          }">
            <template #header>
              <div class="row col-12">
                <div class="col-8">
                  <strong>{{ process }}</strong>
                </div>
                <div class="col-4">
                  {{ processNumbers(info) }} processes complete
                </div>
                <!-- we want progress here https://primevue.org/datatable/#rowgroup_expandable -->

              </div>
            </template>

            <p class="m-0">
            <ul class="list-group list-group-flush">
              <li class="list-group-item" v-for="(task, id) in info['tasks']">
                <div class="row col-12">
                  <div class="col-6">
                    <Tag :value="`Task #${id} - Tag: ${task['tag']}`"></Tag>
                  </div>
                  <div class="col-3 p-1">
                    <ProgressBar class="mt-2" :showValue="false" :value="getProgressValueForTask(task['status'])"
                      style="height: 3px" :pt="{
                        value: { style: { background: generateColorString(task['status']) } }
                      }">


                    </ProgressBar>
                  </div>
                  <div class="col-3">{{ task['status'] }}</div>
                </div>


              </li>
            </ul>

            </p>
          </Panel>




        </div>
      </div>


      <hr>
      <div class="card-body mt-5">
        <h5 class="card-title mb-3">Trace Information for {{workflowState.selectedRun}} </h5>

        <DataTable :value="workflowState.processObjects" sortField="task_id" :sortOrder="1" v-model:filters="filters"
          filterDisplay="row" tableStyle="min-width: 50rem" paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]"
          removableSort>
          <Column field="task_id" header="Task-ID" sortable></Column>
          <Column field="name" style="min-width: 20rem" header="Name" sortable :show-filter-menu="false"
            filter-field="name">
            <template #body="{ data }">
              {{ data.name }}
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
              <Tag :value="data.status" />
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

          <Column field="tag" header="Tag" style="min-width: 20rem" :show-filter-menu="false" sortable>
            <template #filter="{ filterModel, filterCallback }">
              <MultiSelect v-model="filterModel.value" :options="filterState.availableTags"
              :showToggleAll=false filter placeholder="Select Tag" @change="filterCallback()"
              display="chip" class="md:w-20rem" style="max-width: 40vw" optionLabel="name">
              <template #chip="selectedTag">
                <div class="flex align-items-center">
                  <div v-if="Object.keys(selectedTag.value)[0] !== ''">{{ Object.keys(selectedTag.value)[0] }} : {{
                    Object.values(selectedTag.value)[0] }}</div>
                  <div v-if="Object.keys(selectedTag.value)[0] === ''">Empty tag</div>
                </div>
              </template>
              <template #option="slotProps">
                <div class="flex align-items-center">
                  <div v-if="Object.keys(slotProps.option)[0] !== ''">
                    {{ Object.keys(slotProps.option)[0] }}: {{ Object.values(slotProps.option)[0] }}
                  </div>
                  <div v-if="Object.keys(slotProps.option)[0] === ''">Empty tag</div>
                </div>
              </template>
            </MultiSelect>
            </template>
            <template #body="{ data }">
              <Tag v-for="(tag, id) of data.tag" :value="Object.keys(tag)[0] === '' ? 'Empty tag' : Object.keys(tag)[0] + ': ' + Object.values(tag)[0]"></Tag>
            </template>
          </Column>
          <Column field="timestamp" header="Timestamp" sortable></Column>
          <Column field="duration" sortable header="Duration">
            <template #body="{ data }">
              <span v-if="data.duration">{{ (data.duration / 1000).toFixed(2) }} </span>
              <span v-else>No data</span>
            </template>

          </Column>
          <Column field="cpu_percentage" header="CPU %" sortable></Column>
          <Column field="memory_percentage" header="Memory %" sortable></Column>
          <Column field="memory" header="Memory">
            <template #body="{ data }">
              {{ reasonableDataFormat(data.memory) }}
            </template>
          </Column>
          <Column field="disk" header="Disk"></Column>
          <Column field="rchar" header="rchar" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data.char) }}
            </template>
          </Column>
          <Column field="wchar" header="wchar" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data.wchar) }}
            </template>
          </Column>
          <Column field="rss" header="rss" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data.rss) }}
            </template>
          </Column>
          <Column field="peak_rss" header="Peak rss" sortable></Column>
          <Column field="syscr" header="syscr" sortable></Column>
          <Column field="syscw" header="syscw" sortable></Column>
          <Column field="peak_vmem" header="Peak VMem" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data.peak_vmem) }}
            </template>
          </Column>
          <Column field="vmem" header="VMem" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data.vmem) }}
            </template>
          </Column>
          <Column field="read_bytes" header="Read bytes" sortable></Column>
          <Column field="write_bytes" header="Written bytes" sortable>
          </Column>
          <Column field="vol_ctxt" header="Voluntary context switches" sortable></Column>
          <Column field="inv_ctxt" header="Involuntary cs" sortable></Column>
          <Column field="time" header="Time" sortable>
            <template #body="{ data }">
              {{ data.time / 1000 }} s
            </template>
          </Column>
          <Column field="realtime" header="Realtime" sortable>
            <template #body="{ data }">
              {{ (data.realtime / 1000) }} s
            </template>
          </Column>
        </DataTable>
      </div>
    </div>
    <div class="m-2 row-gap-3" v-if="currentlySelectedWorkflowHasPlottableData()">
      <div>
        <h4>Metric visualization</h4>
      </div>
      <div class="card-body mb-5">
        <div class="row mb-2">
          <div class="col-6">
            <MultiSelect v-model="filterState.selectedMetricProcesses" :options="filterState.availableProcesses"
              v-on:change="metricProcessSelectionChanged();" :showToggleAll=false filter placeholder="Select Processes"
              display="chip" class="md:w-20rem" style="max-width: 40vw" optionLabel="name"
              :disabled="filterState.autoselectAllMetricProcesses">
            </MultiSelect>
          </div>
          <div class="col-3">
            <Button :disabled="filterState.autoselectAllMetricProcesses" v-on:click="unselectAllMetricProcesses()"
              label="Deselect all" />
            <Button :disabled="filterState.autoselectAllMetricProcesses" v-on:click="selectAllMetricProcesses()"
              label="Select all" />
          </div>
          <div class="col-3">
            <ToggleButton id="metricSelectButton" v-model="filterState.autoselectAllMetricProcesses"
              onLabel="Autoupdate enabled" offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionMetric()"
              onIcon="pi pi-check" offIcon="pi pi-times" v-on:change="metricProcessAutoSelectionChanged()" />
          </div>
        </div>
        <div class="row mb-2">
          <div class="col-6">
            <MultiSelect v-model="filterState.selectedTags" :options="filterState.availableTags"
              v-on:change="metricTagSelectionChanged();" :showToggleAll=false filter placeholder="Select Tag"
              display="chip" class="md:w-20rem" style="max-width: 40vw" optionLabel="name"
              :disabled="filterState.autoselectAllMetricTags">
              <template #chip="selectedTag">
                <div class="flex align-items-center">
                  <div v-if="Object.keys(selectedTag.value)[0] !== ''">{{ Object.keys(selectedTag.value)[0] }} : {{
                    Object.values(selectedTag.value)[0] }}</div>
                  <div v-if="Object.keys(selectedTag.value)[0] === ''">Empty tag</div>
                </div>
              </template>
              <template #option="slotProps">
                <div class="flex align-items-center">
                  <div v-if="Object.keys(slotProps.option)[0] !== ''">
                    {{ Object.keys(slotProps.option)[0] }}: {{ Object.values(slotProps.option)[0] }}
                  </div>
                  <div v-if="Object.keys(slotProps.option)[0] === ''">Empty tag</div>
                </div>
              </template>
            </MultiSelect>
          </div>
          <div class="col-3">
            <Button :disabled="filterState.autoselectAllMetricTags" v-on:click="unselectAllMetricTags()"
              label="Deselect all" />
            <Button :disabled="filterState.autoselectAllMetricTags" v-on:click="selectAllMetricTags()"
              label="Select all" />
          </div>
          <div class="col-3">
            <ToggleButton id="metricSelectButton" v-model="filterState.autoselectAllMetricTags"
              onLabel="Autoupdate enabled" offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionTags()"
              onIcon="pi pi-check" offIcon="pi pi-times" v-on:change="metricTagAutoSelectionChanged()" />
          </div>
        </div>

        <!-- check if we could push this to the datatable and have checkboxes instead?!-->
      </div>
      <div class="card-body" id="canvas_area">

      </div>
      <hr>
    </div>

    <div class="card-body" v-if="workflowState.error_on_request">
      <div class="alert alert-info">
        This token is not correct, please enter another token
      </div>
    </div>
    <div class="card-body" v-if="workflowState.token_info_requested && !workflowState.error_on_request">
      <div type="button" class="btn btn-outline-danger" @click="confirmDeletion();">
        Delete token
      </div>

    </div>
  </div>
  <Toast position="center" />
  <ConfirmDialog></ConfirmDialog>
</template>

<style scoped></style>
