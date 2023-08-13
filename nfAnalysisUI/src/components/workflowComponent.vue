<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, toRaw } from "vue";
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap/dist/js/bootstrap.min.js";
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
import Process from "../models/Process"
import RadioButton from 'primevue/radiobutton';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel'
import ScrollTop from 'primevue/scrolltop';
import Sidebar from 'primevue/sidebar';
import Menubar from 'primevue/menubar';
import InputSwitch from "primevue/inputswitch";
import InputNumber from "primevue/inputnumber";
import Dropdown from 'primevue/dropdown';
import { PointWithErrorBar, ScatterWithErrorBarsController } from 'chartjs-chart-error-bars';
import annotationPlugin from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';




Chart.register(
  BoxPlotController,
  BoxAndWiskers,
  LinearScale,
  CategoryScale,
  ScatterWithErrorBarsController,
  PointWithErrorBar,
  zoomPlugin,
  annotationPlugin,
);

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
const NON_AUTO_UPDATE_STATES = ["ABORTED", "COMPLETED", "FAILED"];

const STORAGE_UNITS = ['b', 'kiB', 'MiB', 'GiB'];
const TIME_UNITS = ['s', 'min', 'h'];

const FAST_INTERVAL: number = 10000;
const SLOW_INTERVAL: number = 30000;
const filters = ref({
  'status': { value: null, matchMode: FilterMatchMode.IN },
  'name': { value: null, matchMode: FilterMatchMode.CONTAINS },
  'process': { value: null, matchMode: FilterMatchMode.CONTAINS },
  'tag': { value: null, matchMode: 'tagTableFilter', },
});

const rowClass = (data: any) => {
  return [{ 'analysis-alert-row': processIsDeclaredProblematic(data) }];
};

function isProblematic(data: any): boolean {
  data = toRaw(data);
  return processIsDeclaredProblematic(data);
}

function allocationSort(a) {

  if (a["cpu_percentage"] && a["cpus"] && a["cpus"] > 0) {
    return a["cpu_percentage"] / a["cpus"];
  }
  return 0;


}

function processIsDeclaredProblematic(data: any): boolean {
  if (workflowState.selectedRun !== '' && workflowState.selectedRun !== undefined) {
    const keysToCheck: string[] = ["process", "task_id", "run_name"];
    if (workflowState.processAnalysis[workflowState.selectedRun]) {
      return workflowState.processAnalysis[workflowState.selectedRun].some((analysisObj: any) => {
        return keysToCheck.every(key => analysisObj[key] === data[key]);
      });
    }
  }
  return false;
}

/** end of filterService **/


const uiState = reactive<{
  sidebarVisible: boolean;
  menuItems: any[];
}>({
  sidebarVisible: false,
  menuItems: [
    {
      label: 'Open Sidebar',
      icon: 'pi pi-arrow-right',
      command: changeSidebarState,
    },
    {
      label: 'Quit',
      icon: 'pi pi-fw pi-power-off',
      command: goBackToMain,
    },
  ]

});


const requestState = reactive<{
  request_params: any
  request_activated: any,
  comparableWorkflows: string[],
}>({
  request_params: {},
  request_activated: {},
  comparableWorkflows: [],
});


const analysisInfo = reactive<{
  cpuRamRatioText: string;
}>({
  cpuRamRatioText: 'Select a process in the plot to get more information',
});

const workflowState = reactive<{
  currentState: any;
  progress: any;
  runningProcesses: any;
  filteredRunningProcesses: any;
  processObjects: Process[];
  processAnalysis: any;
  tagAnalysis: any;
  fullAnalysis: any;
  runScores: any;
  processesByRun: any;
  runStartMapping: any;
  selectedRun: string;
  failedProcesses: boolean;
  pollIntervalId: any;
  pollIntervalValue: number;
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
    "cached": null,
    "pending": null
  },
  runningProcesses: {},
  filteredRunningProcesses: {},
  processObjects: [],
  processAnalysis: {},
  tagAnalysis: {},
  fullAnalysis: {},
  runScores: {},
  processesByRun: {},
  runStartMapping: {},
  selectedRun: '',
  failedProcesses: false,
  pollIntervalId: null,
  pollIntervalValue: 0,
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
  cpuCanvas: any | null;
  cpuAllocationCanvas: any | null;
  cpuAllocationChart: any | null;
  cpuRamRatioCanvas: any | null;
  cpuRamRatioChart: any | null;
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
  cpuAllocationCanvas: null,
  cpuAllocationChart: null,
  cpuRamRatioCanvas: null,
  cpuRamRatioChart: null,
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
  autoselectAllRunningProcesses: boolean;
  autoselectAllRunningTags: boolean;
  autoselectAllMetricTags: boolean;
  selectedTags: string[];
  selectedRunningTags: any[];
  selectedRunningProcesses: any[];
  processTaskMapping: any;

}>({
  availableProcesses: [],
  availableTags: [],
  selectedMetricProcesses: [],
  autoselectAllMetricProcesses: true,
  selectedProgressProcesses: [],
  autoselectAllProgressProcesses: true,
  autoselectAllRunningProcesses: true,
  autoselectAllRunningTags: true,
  autoselectAllMetricTags: true,
  selectedTags: [],
  selectedRunningTags: [],
  selectedRunningProcesses: [],
  processTaskMapping: {},

});

/** functions on init and polling */

function getDataInitial(token = props.token): void {
  if (token.length > 0) {
    workflowState.loading = true;
    axios.post(`http://localhost:8000/run/info/${token}/`,
      setAnalysisParams(),
    ).then(
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
          updateFilterState();
          workflowState.runningProcesses = updateRunningProcesses();
          updateFilteredRunningProcesses()
          workflowState.processAnalysis = response.data["result_analysis"]["process_wise"];
          workflowState.tagAnalysis = response.data["result_analysis"]["tag_wise"]
          workflowState.fullAnalysis = response.data["result_analysis"]
          workflowState.runScores = response.data["result_scores"];
          updateCurrentState();
          updateProgress();

          workflowState.token_info_requested = true;
          workflowState.token = token;
          workflowState.error_on_request = false;
          
          progressProcessSelectionChanged();
          if (currentlySelectedWorkflowHasPlottableData()) {
            createPlots();
          }
          startPollingLoop();
        }
      },
    );
    // workflowState.connection = new WebSocket(`wss://localhost:8000/run/${token}`); possible websocket connection
  }

}

function setAnalysisParams(): any {
  let params: any = {};
  if (requestState.request_activated["top_percent_ratio"]) {
    params["top_percent_ratio"] = requestState.request_params["top_percent_ratio"];
    params["limit_processes_per_domain_by_number"] = requestState.request_params["limit_processes_per_domain_by_number"];
  }
  if (requestState.request_activated['interval_valid_cpu_allocation_percentage']) {
    params['interval_valid_cpu_allocation_percentage'] = [
      requestState.request_params['interval_valid_cpu_allocation_percentage_min'],
      requestState.request_params['interval_valid_cpu_allocation_percentage_max'],
    ]
  }
  if (requestState.request_activated['interval_valid_ram_relation']) {
    params['interval_valid_ram_relation'] = [
      requestState.request_params['interval_valid_ram_relation_min'],
      requestState.request_params['interval_valid_ram_relation_max'],
    ]
  }

  return params;
}

function destroyPollTimer(): void {
  clearInterval(workflowState.pollIntervalId);

}

function startPollingLoop(): void {
  if (currentlyNonFinishedWorkflows()) {
    updateToFasterPolling();
  } else {
    updateToSlowerPolling();
  }
}

function dataPollingLoop(): void {
  axios.post(`http://localhost:8000/run/info/${workflowState.token}/`,
    setAnalysisParams(),
  ).then(
    response => {
      if (response.data["error"]) {
        workflowState.error_on_request = true;

      } else {
        workflowState.meta = response.data["result_meta"];
        workflowState.processesByRun = createProcessObjectsByRun(response.data["result_by_run_name"]);
        updateRunStartMapping();
        workflowState.processObjects = workflowState.processesByRun[workflowState.selectedRun];
        updateFilterState();
        workflowState.runningProcesses = updateRunningProcesses();
        updateFilteredRunningProcesses();
        workflowState.processAnalysis = response.data["result_analysis"]["process_wise"]
        workflowState.tagAnalysis = response.data["result_analysis"]["tag_wise"]
        workflowState.fullAnalysis = response.data["result_analysis"]
        workflowState.runScores = response.data["result_scores"];
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
        checkForPollingTimerAdjustment();
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
  setSelectedRunningProcesses(filterState.availableProcesses);
  setSelectedRunningTags(filterState.availableTags);
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

function setSelectedRunningTags(tags: any[]): void {
  filterState.selectedRunningTags = tags;
}

function setSelectedProgressProcesses(processes: any[]): void {
  filterState.selectedProgressProcesses = processes;
}

function setSelectedRunningProcesses(processes: any[]): void {
  filterState.selectedRunningProcesses = processes;
}

function selectAllMetricProcesses(): void {
  updateAvailableProcessNamesForFilter();
  setSelectedMetricProcesses(filterState.availableProcesses);
  metricProcessSelectionChanged();
}

function selectAllRunningProcesses(): void {
  updateAvailableProcessNamesForFilter();
  setSelectedRunningProcesses(filterState.availableProcesses);
  runningProcessSelectionChanged();
}

function unselectAllMetricProcesses(): void {
  setSelectedMetricProcesses([]);
  metricProcessSelectionChanged();
}

function unselectAllMetricTags(): void {
  setSelectedMetricTags([]);
  metricTagSelectionChanged();
}

function unselectAllRunningTags(): void {
  setSelectedRunningTags([]);
  runningTagSelectionChanged();
}

function selectAllMetricTags(): void {
  setSelectedMetricTags(filterState.availableTags);
  metricTagSelectionChanged();
}

function selectAllRunningTags(): void {
  setSelectedRunningTags(filterState.availableTags);
  runningTagSelectionChanged();
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

function unselectAllRunningProcesses(): void {
  setSelectedRunningProcesses([]);
  runningProcessSelectionChanged();
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
  if (workflowState.processObjects) {
    for (let process of workflowState.processObjects) {
      if (filterState.selectedProgressProcesses.some(obj => obj['name'] === process.process)) {
        filtered[process.process] = process;
      }
    }
  }

  workflowState.filteredProgressProcesses = filtered;
}

function updateFilteredRunningProcesses(all: boolean = false): void {
  let filtered: any = {};
  if (all) {
    filterState.selectedRunningProcesses = toRaw(filterState.availableProcesses);
   
  }
  let tagFilter: boolean = false;
  let selectedTags: any = null;
  if (filterState.selectedRunningTags.length > 0 && filterState.selectedRunningTags.length !== filterState.availableTags.length) {
    tagFilter = true;
    selectedTags = toRaw(filterState.selectedTags);
  }
  
  let runningProcesses = toRaw(workflowState.runningProcesses);
  if (Object.keys(runningProcesses).length > 0 ) {
    for (let process of Object.values(runningProcesses)) {
      if (tagFilter) {
        if (!selectedTags.some(tag => checkTagMatch(tag, process.tag))) {
          continue;
        }
      }
      process = toRaw(process);
      for (let prc of process) {
        if (filterState.selectedRunningProcesses && filterState.selectedRunningProcesses.length > 0){
          if (filterState.selectedRunningProcesses.some(obj => obj['name'] === prc.process)) {
            if (!(prc.process in filtered)) {
                filtered[prc.process] = []
            }
          filtered[prc.process].push(process)
        }
      } 
      }
    }
  }

  workflowState.filteredRunningProcesses = filtered;
}


function progressProcessSelectionChanged(): void {
  updateFilteredProgressProcesses();
}

function runningProcessSelectionChanged(): void {
  updateFilteredRunningProcesses();
}


function metricProcessSelectionChanged(): void {
  if (filterState.selectedMetricProcesses.length > 0 && metricCharts.chartsGenerated) {
    updatePlots();
  }
}

function metricTagSelectionChanged(): void {
  updatePlots();
}

function runningTagSelectionChanged(): void{
  // pass?
}


function metricProcessAutoSelectionChanged(): void {
  if (filterState.autoselectAllMetricProcesses && !NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun])) {
    selectAllMetricProcesses();
  } else {
    // what to do here?
  }
}

function metricTagAutoSelectionChanged(): void {
  if (filterState.autoselectAllMetricTags && !NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun])) {
    selectAllMetricTags();
  }
}

function runningTagAutoSelectionChanged(): void {
  if (filterState.autoselectAllRunningTags && !NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun])) {
    selectAllRunningTags();
  }
}

function runningProcessAutoSelectionChanged(): void {
  if (filterState.autoselectAllRunningProcesses && !NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun])) {
    updateFilteredRunningProcesses(true);
  }
}

function progressProcessAutoSelectionChanged(): void {
  if (filterState.autoselectAllProgressProcesses && !NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun])) {
    updateFilteredProgressProcesses(true);
  } else {
    // what to do here?
  }
}

function hideAutoUpdateEnableOptionMetric(): boolean {
  return NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun]) && !filterState.autoselectAllMetricProcesses;
}

function hideAutoUpdateEnableOptionRunning(): boolean {
  return NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun]) && !filterState.autoselectAllRunningProcesses;
}

function hideAutoUpdateEnableOptionRunningTags(): boolean {
  return NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun]) && !filterState.autoselectAllRunningTags;
}

function hideAutoUpdateEnableOptionProgress(): boolean {
  return NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun]) && !filterState.autoselectAllProgressProcesses;
}

function hideAutoUpdateEnableOptionTags(): boolean {
  return NON_AUTO_UPDATE_STATES.includes(workflowState.currentState[workflowState.selectedRun]) && !filterState.autoselectAllMetricTags;
}


/** end of filter state functions */

/** Plot creation **/

async function createPlots() {
  await delay(300);
  createRamPlot();
  createRelativeRamPlot();
  createCPUPlot();
  createCPUAllocationPlot();
  createIOPlot();
  createDurationPlot();
  createCPURamRatioPlot();
  metricCharts.chartsGenerated = true;
}

/* TODO: REFACTOR regarding asynchron
*/
function getCanvasDiv(elementId: string): HTMLCanvasElement {
  const canvasElement = document.getElementById(elementId);
  return canvasElement;

}

async function createRelativeRamPlot() {
  const canvas: HTMLCanvasElement = getCanvasDiv('relative_ram_canvas');
  metricCharts.relativeMemoryCanvas = canvas;
  const relativeRamChart = new Chart(
    metricCharts.relativeMemoryCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'Memory usage in % (physical memory to requested memory)',
            }
          }
        },
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

  const canvas: HTMLCanvasElement = getCanvasDiv('io_canvas')
  metricCharts.ioCanvas = canvas;

  const ioChart = new Chart(
    metricCharts.ioCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'amount of read and written data in GiB',
            }
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
  const canvas: HTMLCanvasElement = getCanvasDiv('duration_canvas');
  metricCharts.durationCanvas = canvas;
  const durationChart = new Chart(
    metricCharts.durationCanvas,
    {
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: "Duration in minutes"
            }
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
  const canvas: HTMLCanvasElement = getCanvasDiv('ram_canvas');
  metricCharts.memoryCanvas = canvas;

  const memoryChart = new Chart(
    metricCharts.memoryCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'RAM value in GiB'
            },
          },
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
  const canvas: HTMLCanvasElement = getCanvasDiv('cpu_canvas');
  metricCharts.cpuCanvas = canvas;
  const cpuChart = new Chart(
    metricCharts.cpuCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'CPU value in %'
            },
          },
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

async function createCPUAllocationPlot() {
  const canvas: HTMLCanvasElement = getCanvasDiv('cpu_allocation_canvas');
  metricCharts.cpuAllocationCanvas = canvas;
  const cpuAllocationChart = new Chart(
    metricCharts.cpuAllocationCanvas,
    {
      type: 'boxplot',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'CPU allocation value in %'
            },
          },
        }
      },
      data: {
        labels: [],
        datasets: [],
      }
    }
  );
  Object.seal(cpuAllocationChart);
  metricCharts.cpuAllocationChart = cpuAllocationChart;

  updateCPUAllocationPlot();

}

async function createCPURamRatioPlot() {
  const canvas: HTMLCanvasElement = getCanvasDiv('cpu_ram_ratio');
  metricCharts.cpuRamRatioCanvas = canvas;
  const cpuRamRatioChart = new Chart(
    metricCharts.cpuRamRatioCanvas,
    {
      type: 'scatterWithErrorBars',
      options: {
        responsive: true,
        plugins: {
          zoom: {
            pan: {
              enabled: true,
              modifierKey: 'ctrl',
            },
            zoom: {
              drag: {
                enabled: true,
              },
              mode: 'xy',
            },
          },
          annotation: {
            annotations: {
              box_valid: {
                type: 'box',
                xMin: 80,
                xMax: 105,
                yMin: 80,
                yMax: 105,
                backgroundColor: 'rgba(38, 131, 17, 0.22)',
                borderWidth: 0,
              },

            },
          },
          legend: {
            display: true,
          },
          tooltip: {
            enabled: true
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'CPU allocation in %',
            },
            min: 0,
            ticks: {
              callback: function (value, index, ticks) {
                return value + ' %'
              }
            }
          },
          y: {
            title: {
              display: true,
              text: 'RAM usage in % (used related to requested)',
            },
            min: 0,
            ticks: {
              // Include a dollar sign in the ticks
              callback: function (value, index, ticks) {
                return value + ' %'
              }
            }
          }
        },
        /**
         * open-ai query: consider having a scatter plot with chart.js.
is there a possibility to connect the datapoints with certain ids or other values, so when a scatter-plot datapoint gets clicked, it emits this certain id or value?
         */
        onClick: function (event, datapoints) {
          if (datapoints.length > 0) {
            let element = datapoints[0];
            let datasetIndex = element.datasetIndex;
            let index = element.index;
            let clickedProcess: string = metricCharts.cpuRamRatioChart.data.datasets[datasetIndex].data[index].id;
            adjustTextForRatioMessage(clickedProcess);
          }
        },
        onHover: function (event, datapoints) {
          if (datapoints.length > 0) {
            event.native.target.style.cursor = 'pointer';
          } else {
            event.native.target.style.cursor = 'default';
          }
        },

      },
      data: {
        labels: [],
        datasets: [],
      }

    }
  )
  Object.seal(cpuRamRatioChart);
  metricCharts.cpuRamRatioChart = cpuRamRatioChart;

  updateCPURamRatioChart();
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
    updateCPURamRatioChart();
  }

}

function updateIOPlot() {
  let generatedDatasets: [string[], any[]] = generateDataByMultipleKeys(
    ['read_bytes', 'write_bytes'],
    true,
    'GiB',
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
    'GiB',
    ['Requested memory in ', 'Virtual memory in ', 'Physical memory in '],
    filterState.selectedMetricProcesses,
  );
  metricCharts.memoryChart.data.labels = getSuffixes(generatedDatasets[0]);
  metricCharts.memoryChart.data.datasets = generatedDatasets[1];
  metricCharts.memoryChart.update('none');
}

function updateCPUPlot() {
  let generatedDatasets: [string[], any[]] = generateCPUData();

  metricCharts.cpuChart.data.labels = getSuffixes(generatedDatasets[0]);
  metricCharts.cpuChart.data.datasets = generatedDatasets[1];
  metricCharts.cpuChart.update('none');
}

function updateCPUAllocationPlot() {
  let generatedDatasets: [string[], any[]] = generateKeyRelativeData('cpu_percentage', 'cpus', 'CPU Allocation', 1);


  metricCharts.cpuAllocationChart.data.labels = getSuffixes(generatedDatasets[0]);
  metricCharts.cpuAllocationChart.data.datasets = generatedDatasets[1];
  metricCharts.cpuAllocationChart.update('none');
}

function updateCPURamRatioChart() {
  let rawedFullAnalysis: any = toRaw(workflowState.fullAnalysis);
  metricCharts.cpuRamRatioChart.data.labels = getSuffixes(rawedFullAnalysis['cpu_ram_relation_data'][workflowState.selectedRun]['labels']);
  metricCharts.cpuRamRatioChart.data.datasets = [rawedFullAnalysis['cpu_ram_relation_data'][workflowState.selectedRun]['data']];
  metricCharts.cpuRamRatioChart.update('none');

}

function updateDurationPlot() {
  let generatedDatasets: [string[], any[]] = generateDurationData('min');
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
 *  only returns the keys
*/
function sortByScore(scores: any) {
  return Object.keys(scores).sort((run_a, run_b) => scores[run_a]["full_run_score"] - scores[run_b]["full_run_score"]);
}


function getCPURatioAnalysisString(elem: any[]) {
  let lower = 80, higher = 120;
  if (requestState.request_activated['interval_valid_cpu_allocation_percentage']) {
    if (requestState.request_params['interval_valid_cpu_allocation_percentage_min'] && requestState.request_params['interval_valid_cpu_allocation_percentage']) {
      lower = requestState.request_params['interval_valid_cpu_allocation_percentage_min'];
      higher = requestState.request_params['interval_valid_cpu_allocation_percentage_max'];
    }
  }
  if (elem[0] < lower) {
    if (elem[1] < lower) {
      if (elem[2] < lower) {
        return "The process requires less than the requested CPU resources for all instances."
      } else if (elem[2] > higher) {
        return "The process requires less CPU resources than requested for several instances, but there are also cases where the process requires significantly more.";
      } else {
        return "For some executions, the process requires less than the requested CPU resources";
      }
    } else if (elem[1] > higher) {
      return "The process requires less CPU resources than requested for several instances, but for most cases where it requires significantly more.";
    } else {
      if (elem[2] > higher) {
        return "The process requires less CPU resources than requested for several instances, but there are also cases where the process requires significantly more.";
      } else {
        return "For some executions, the process requires less than the requested CPU resources";
      }
    }
  } else if (elem[0] > higher) {
    return "The process is using more CPU as wanted for all process instances. It may be useful, to adjust the number of available CPUs for this process.";

  } else {
    if (elem[1] < higher) {
      if (elem[2] < higher) {
        return "The CPU resources allocated to the process are well used!";
      } else {
        return "For some executions, this process requires more CPU resources than requested.";
      }
    } else {
      return "For most executions this process requires more CPU resources than requested.";
    }
  }
}

function getRAMRatioAnalysisString(elem: any[]) {
  let lower = 80, higher = 120;

  if (elem[0] < lower) {
    if (elem[1] < lower) {
      if (elem[2] < lower) {
        return "The process requires less than the requested Memory resources for all instances."
      } else if (elem[2] > higher) {
        return "The process requires less Memory resources than requested for several instances, but there are also cases where the process requires significantly more.";
      } else {
        return "For some executions, the process requires less than the requested Memory resources";
      }
    } else if (elem[1] > higher) {
      return "The process requires less memory resources than requested for several instances, but for most cases where it requires significantly more.";
    } else {
      if (elem[2] > higher) {
        return "The process requires less memory resources than requested for several instances, but there are also cases where the process requires significantly more.";
      } else {
        return "For some executions, the process requires less than the requested memory resources";
      }
    }
  } else if (elem[0] > higher) {
    return "The process is using more memory as wanted for all process instances. It may be useful, to adjust the amount of available memory for this process.";

  } else {
    if (elem[1] < higher) {
      if (elem[2] < higher) {
        return "The memory resources allocated to the process are well used!";
      } else {
        return "For some executions, this process requires more memory resources than requested.";
      }
    } else {
      return "For most executions this process requires more memory resources than requested.";
    }
  }
}




function adjustTextForRatioMessage(clickedProcess: string) {

  let analysisData: any[] = toRaw(workflowState.fullAnalysis["cpu_ram_relation_data"][workflowState.selectedRun]["data"]["data"]);
  let elem = analysisData.find((processValues) => {
    return processValues.id == clickedProcess;
  });

  let cpu_data: any[] = [elem["xMin"], elem["x"], elem["xMax"]];
  let memory_data: any[] = [elem["yMin"], elem["y"], elem["yMax"]];



  let concatString = `The process ${getSuffix(clickedProcess)} has the following characteristics: \n`
    + `The CPU allocation varies from ${cpu_data[0].toFixed(2)} % to ${cpu_data[2].toFixed(2)} % with an average of ${cpu_data[1].toFixed(2)} %.\n`
    + `The used memory percentage varies from ${memory_data[0].toFixed(2)} % to ${memory_data[2].toFixed(2)}  with an average of ${memory_data[1].toFixed(2)} %.\n`
    + getCPURatioAnalysisString(cpu_data) + '\n' + getRAMRatioAnalysisString(memory_data);

  analysisInfo.cpuRamRatioText = concatString;

}

function problemToMessage(problem: any): string {
  const problemKey: string = Object.keys(problem)[0];
  let problemValue: any = Object.values(problem)[0];
  switch (problemKey) {
    case 'ram_relative': {

      if (problemValue < 0.6) {
        return `The process is consuming only ${(problemValue * 100).toFixed(2)}% of the requested RAM.`;
      } else {
        return `The process is consuming significantly more RAM than requested: It uses ${(problemValue * 100).toFixed(2)}% of the requested RAM.`;
      }
    }
    case 'cpu_allocation': {
      if (problemValue < 60) {
        return `The process is consuming only ${problemValue.toFixed(2)}% of the allocated CPUs.`;
      } else {
        return `The process is consuming significantly high values of CPU. It uses ${problemValue.toFixed(2)}% of the allocated CPUs.`;
      }
    }
    case 'duration_ratio_compared_to_other_processes': {
      return `This process is relatively slow compared to other types of processes. It uses ${(problemValue * 100).toFixed(2)}% of the average time`;
    }
    case 'duration_ratio_to_requested': {
      return `The runtime of the process is too long in relation to the requested runtime. It is ${(problemValue * 100).toFixed(2)} % of the requested time.`
    }
    case 'duration_ratio_compared_to_all': {
      return `This process is relatively slow compared to all processes executed in this workflow run. It uses ${(problemValue * 100).toFixed(2)}% of the average time`;
    }
    case 'duration_ratio_compared_to_same': {
      return `This process is relatively slow compared to processes with the same type. It uses ${(problemValue * 100).toFixed(2)}% of the average time for processes of the same type.`;
    }
    case 'tag_duration_comparison_ratio': {
      return `Processes which run with this tag, need ${(problemValue * 100).toFixed(2)}% of the time, processes with other tags need.`;
    }
    case 'tag_duration_to_full_ratio': {
      return `Processes which run with this tag, use the majority of time. They are responsible for ${(problemValue * 100).toFixed(2)}% of the runtime.`;
    }
    case 'tag_cpu_allocation_ratio': {
      return `Processes which run with this tag, allocate comparably much CPU. They take ${(problemValue * 100).toFixed(2)}% of the average CPU allocation of the CPU.`;
    }
    case 'tag_cpu_percentage_ratio': {
      return `Processes which run with this tag, use comparably high values of CPU. ${(problemValue * 100).toFixed(2)}% of the average CPU usage values are used.`;
    }
    case 'tag_memory_ratio': {
      return `Processes which run with this tag, use comparably high values of RAM. It is ${(problemValue * 100).toFixed(2)}% of the average RAM usage.`;
    }
  }
  return 'There seems to be an error displaying this alert.';
}

function currentlySelectedWorkflowHasPlottableData(): boolean {
  if (workflowState.selectedRun !== '') {
    return workflowState.currentState[workflowState.selectedRun] && workflowState.currentState[workflowState.selectedRun] !== "WAITING";
  }
  return false;

}

function tagToString(tag: any) {

  if (Object.keys(tag)[0] !== '') {
    return `${Object.keys(tag)[0].toString()}: ${Object.values(tag)[0].toString()}`
  } else {
    return 'Empty tag';
  }
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
  const options: any = { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
  return new Intl.DateTimeFormat('de-DE', options).format(date);
}

function adjustSelectedRun(): void {
  workflowState.processObjects = workflowState.processesByRun[workflowState.selectedRun];
  updateFilterState();
  updateFilteredProgressProcesses();
  updateCurrentState();
  updateProgress();
  if (currentlySelectedWorkflowHasPlottableData()) {
    if (metricCharts.chartsGenerated) {
      updatePlots();
    } else {
      createPlots();
    }

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
      if (meta["event"] === "started") {
        result[meta["run_name"]] = new Date(meta["timestamp"]);
        if ([undefined, "WAITING"].includes(workflowState.currentState[meta["run_name"]])) {
          workflowState.currentState[meta["run_name"]] = "SUBMITTED";
          updateToFasterPolling();
        }
      }
    }
  }
  workflowState.runStartMapping = result;


}

function changeSidebarState(value: boolean = true): void {
  uiState.sidebarVisible = value;
}

function goBackToMain(): void {
  router.push("/");
}

function startBackToMainTimer(): void {
  destroyPollTimer();
  setTimeout(() => {
    goBackToMain();

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
  let cached: number = 0;
  let pending: number = 0;
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
          failed += 1;
          break;
        case "COMPLETED":
          completed += 1;
          break;
        case "CACHED":
          cached += 1;
          break;
        case "PENDING":
          pending += 1;
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
    "cached": cached,
    "pending": pending,
  }

}


function adjustCurrentStateForRun(nameKey: string, meta: any) {

  if (meta['event'] === "started") {
    let processes: Process[] = toRaw(workflowState.processObjects);
    if (processes) {
      if (["SUBMITTED", "WAITING", undefined].includes(workflowState.currentState[nameKey])) {
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
  } else {
    workflowState.currentState[nameKey] = "SUBMITTED";
  }

  checkForPollingTimerAdjustment();
}

function checkForPollingTimerAdjustment(): void {
  if (currentlyNonFinishedWorkflows()) {
    updateToFasterPolling();
  } else {
    updateToSlowerPolling();
  }
}

function currentlyNonFinishedWorkflows(): boolean {
  return !(Object.values(workflowState.currentState).every((state: any) => NON_AUTO_UPDATE_STATES.includes(state)));
}

function updateToFasterPolling(): void {
  if (workflowState.pollIntervalId) {
    if (workflowState.pollIntervalValue === FAST_INTERVAL) {
      return;
    }
    clearInterval(workflowState.pollIntervalId)
    workflowState.pollIntervalValue = 0;
  }
  workflowState.pollIntervalId = setInterval(dataPollingLoop, FAST_INTERVAL);
  workflowState.pollIntervalValue = FAST_INTERVAL;
}

function updateToSlowerPolling(): void {
  if (workflowState.pollIntervalId) {
    if (workflowState.pollIntervalValue === SLOW_INTERVAL) {
      return;
    }
    clearInterval(workflowState.pollIntervalId)
    workflowState.pollIntervalValue = 0;
  }
  workflowState.pollIntervalId = setInterval(dataPollingLoop, SLOW_INTERVAL);
  workflowState.pollIntervalValue = SLOW_INTERVAL;
}

function updateRunningProcesses(): any {

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

function latestMetaForRun(): any {
  if (workflowState.meta.length> 0) {
    const metas = workflowState.meta.filter((obj: any) => obj["run_name"] === workflowState.selectedRun);
    const lngt = metas.length;
    if (lngt > 0){
     return metas[lngt - 1]; 
    }
   } 

   return null;
  }

function getSuffix(str: string) {
  const parts: string[] = str.split(":");

  return parts[parts.length - 1];
}

function getDynamicDurationTypeAsNumber(duration: number, unit: any = null): number {
  if (!unit) {
    return duration;
  } else {
    duration = duration / 1000
    if (unit === 's') {
      return duration;
    }
    duration = duration / 60;
    if (unit === 'min') {
      return duration;
    }
    duration = duration / 60
    return duration;
  }
}

function getDynamicDurationType(duration: number): string {
  let durationInSeconds = duration / 1000;
  if (durationInSeconds > 60) {
    let durationInMinutes = durationInSeconds / 60;
    if (durationInMinutes > 60) {
      let durationInHours = durationInMinutes / 60;
      let fullHours = Math.floor(durationInHours);
      let rest = durationInHours - fullHours;

      return `${fullHours}:${(60 * rest).toFixed(0)} h`;
    } else {
      let fullMinutes = Math.floor(durationInMinutes);
      let rest = durationInMinutes - fullMinutes;

      return `${fullMinutes}:${(60 * rest).toFixed(0)}  min`;
    }
  } else {
    return `${durationInSeconds.toFixed(0)} s`;
  }
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

function getSingleDataInValidStorageFormat(num: number, wantedType: string): number {
  const types: string[] = STORAGE_UNITS;
  let idx: number = 0;
  if (num) {
    while (types[idx] !== wantedType && idx < types.length) {
      num = num / 1024
      idx++;
    }
  }
}

function getDataInValidStorageFormat(byte_numbers: number[], wantedType: string): [number[], string] {
  const types: string[] = STORAGE_UNITS;
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

function generateSummarizedDataByKey(key: string, factorizer: number = 1, unit: any = null): any {
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
      let value: any = process[key];
      if (value && unit) {
        if (TIME_UNITS.includes(unit)) {
          value = getDynamicDurationTypeAsNumber(value, unit);
        } else if (STORAGE_UNITS.includes(unit)) {
          value = getSingleDataInValidStorageFormat(value, unit);
        }
      }
      if (!(process.process in processDataMapping)) {
        processDataMapping[process.process] = [value];
      } else {
        processDataMapping[process.process].push(value);
      }

    }
  }

  for (let processMap in processDataMapping) {
    if (factorizer !== 1 && unit === null) {
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
    temporaryValues = temporaryValues.map((lst: any[]) => getDataInValidStorageFormat(lst, wantedFormat)[0]);
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
      single_dataset['data'] = Object.values(processDataMapping).map((lst: number[]) => getDataInValidStorageFormat(lst, wantedFormat)[0]);
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


function generateAnalysisRatioData(): [string[], any[]] {
  return [];
}

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
    }
    if (processesToFilterBy.some(obj => obj['name'] === process.process)) {
      if (!(process.process in processDataMapping)) {
        processDataMapping[process.process] = [(process[dataKey] / process[respectToKey]) * factor];
      } else {
        processDataMapping[process.process].push((process[dataKey] / process[respectToKey]) * factor)
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
  let allocation_data: any[] = [];
  let raw_usage_data: any[] = [];

  for (let process of states) {
    if (tagFilter) {
      if (!selectedTags.some((tag: any) => checkTagMatch(tag, process.tag))) {
        continue;
      }
    }
    if (processesToFilterBy.some(obj => obj['name'] === process.process)) {
      if (!(process.process in processDataMapping)) {
        if (process.cpus) {
          processDataMapping[process.process] = { "cpu": [process.cpus] }
        } else {
          processDataMapping[process.process] = { "cpu": [null] }
        }
        if (process.cpu_percentage) {
          processDataMapping[process.process]["percentage"] = [process.cpu_percentage];
        } else {
          processDataMapping[process.process]["percentage"] = [null];
        }
      } else {
        if (process.cpus) {
          processDataMapping[process.process]["cpu"].push(process.cpus);
        } else {
          processDataMapping[process.process]["cpu"].push(null);
        }
        if (process.cpu_percentage) {
          processDataMapping[process.process]["percentage"].push(process.cpu_percentage);
        } else {
          processDataMapping[process.process]["percentage"].push(null);
        }
      }
    }
  }

  for (let process in processDataMapping) {
    let single_raw_data: number[] = []
    let single_allocation_data: number[] = [];
    for (let i = 0; i < processDataMapping[process]["cpu"].length; i++) {
      single_raw_data.push(processDataMapping[process]["percentage"][i]);
      single_allocation_data.push(processDataMapping[process]["percentage"] / processDataMapping[process]["cpu"]);
    }
    raw_usage_data.push(single_raw_data);
    allocation_data.push(single_allocation_data);
  }


  datasets.push({ 'label': 'Requested CPU used in %', 'data': allocation_data, 'maxBarThickness': 30 })
  datasets.push({ 'label': 'CPU usage in %', 'data': raw_usage_data, 'maxBarThickness': 30 });

  return [Object.keys(processDataMapping), datasets]
}

function generateDurationData(unit: string): [string[], any[]] {
  let data_sum = generateSummarizedDataByKey('duration', 1000, unit);
  let data_exec = generateDataByKey('realtime', false, unit);
  let data_execution: any[] = [];
  data_exec['data'].forEach((element: any[]) => {
    let mapped: any[] = element.map((value) => getDynamicDurationTypeAsNumber(value, unit));
    data_execution.push(mapped);
  });
  //let data_allocated = generateKeyRelativeData('realtime', 'time', 'Requested time used in %', 100)[1];

  let datasets: any[] =
    [
      {
        type: 'bar',
        label: `Summarized Duration in ${unit}`,
        data: data_sum["data"],
        'maxBarThickness': 30,
      },
      {
        type: 'boxplot',
        label: 'Execution in real-time',
        data: data_execution,
        'maxBarThickness': 30,
      },
      /* {
        type: 'boxplot',
        label: 'Requested time used in %',
        data: data_allocated[1],
        'maxBarThickness': 30,
      } */
    ];
  return [getSuffixes(data_exec["labels"]), datasets];


}


/** end of data retrieval functions */ 


function goToDiv(divId: string): void {
  let targetDiv = document.getElementById(divId);
  if (targetDiv) {
    targetDiv.scrollIntoView({ behavior: 'smooth' });
  }
}

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
  <div class="card relative z-2 fixed-top bg-white">
    <Menubar :model="uiState.menuItems">
      <template #start>
        <img alt="logo" src="https://primefaces.org/cdn/primevue/images/logo.svg" height="40" class="mx-4" />

      </template>
      <template #end>
        <div class="mx-5">
          <h5>Workflow information for token {{ workflowState.token }}</h5>
        </div>
      </template>
    </Menubar>
  </div>


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


    <div class="card-body mt-4 py-4" v-if="workflowState.token && Object.keys(workflowState.processesByRun).length > 0"
      id="run_selection_div">
      <h3 class="card-title">Select runs</h3>
      <div class="row flex flex-wrap m-2" v-for="key in Object.keys(workflowState.processesByRun)">
        <div class="flex col-auto align-items-center">
          <RadioButton v-model="workflowState.selectedRun" v-on:update:model-value="adjustSelectedRun()" :input-id="key"
            :value="key" />
          <label :for="key" class="ms-2">
            {{ key }} - {{ workflowState.runStartMapping[key] ? ' started at ' +
              formattedDate(workflowState.runStartMapping[key]) : 'no start-date available' }}
          </label>
        </div>
      </div>
    </div>

  
    <div class="card-body m-4" v-if="workflowState.selectedRun === ''">
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
      <Message v-if="currentlySelectedWorkflowHasPlottableData()" :closable="false"
        :severity="severityFromWorkflowState()">
        {{ messageFromWorkflowState() }}</Message>
      <Message v-if="workflowState.failedProcesses" severity="warn">There are processes, which failed during execution of
        the workflow!</Message>
      <Message :closable="false"
        v-if="workflowState.processAnalysis[workflowState.selectedRun]?.length > 0 || workflowState.tagAnalysis[workflowState.selectedRun]?.length > 0"
        severity="warn">
        In the analysis of the metrics, it was found that improvements can possibly be made in the development of the
        workflow.
        You are able to check this in the analysis section of this page.
      </Message>
    </div>
    <div class="card-body my-4" v-if="workflowState.selectedRun && workflowState.meta.length > 0">
  
      <ul class="list-group list-group-flush">
        <li class="list-group-item"><strong>Run Information</strong></li>
        <li class="list-group-item" v-if="latestMetaForRun()['commmand_line']">Command Line - {{latestMetaForRun()['commmand_line']}}</li>
        <li class="list-group-item" v-if="latestMetaForRun()['nextflow_version']">Nextflow Version - {{latestMetaForRun()['nextflow_version']}}</li>
        <li class="list-group-item" v-if="latestMetaForRun()['work_dir']">Work Directory - {{latestMetaForRun()['work_dir']}}</li>
        <li class="list-group-item" v-if="latestMetaForRun()['user_name']">User Name - {{latestMetaForRun()['user_name']}}</li>
        <li class="list-group-item" v-if="latestMetaForRun()['project_name']">Project Name - {{latestMetaForRun()['project_name']}}</li>
        <li class="list-group-item" v-if="latestMetaForRun()['revision']">Revision - {{latestMetaForRun()['revision']}}</li>
        <li class="list-group-item" v-if="latestMetaForRun()['script_file']">Command Line - {{latestMetaForRun()['script_file']}}</li>
      </ul>
      
    </div>
    <div class="card-body my-4" v-if="currentlySelectedWorkflowHasPlottableData()" id="progess_summary_div">
      <h3 class="card-title">Progress</h3>
      <hr>
      <div>
        <div class="mb-4 p-4">
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
        <div class="row p-2">
          <div class="col-2 p-2">
            <Knob v-if="workflowState.progress['all'] > 0" :min="0" :max="workflowState.progress['all']"
              v-model="workflowState.progress['submitted']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center mx-4">Submitted</span>
          </div>
          <div class="col-2 p-2">
            <Knob v-if="workflowState.progress['all'] > 0" :min="0" :max="workflowState.progress['all']"
              v-model="workflowState.progress['pending']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center mx-4">Pending</span>
          </div>
          <div class="col-2 p-2">
            <Knob v-if="workflowState.progress['all'] > 0" :min="0" :max="workflowState.progress['all']"
              v-model="workflowState.progress['running']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center mx-4">Running</span>
          </div>
          <div class="col-2 p-2">
            <Knob v-if="workflowState.progress['all'] > 0" :min="0" :max="workflowState.progress['all']"
              v-model="workflowState.progress['cached']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center mx-4">Cached</span>
          </div>
          <div class="col-2 p-2">
            <Knob v-if="workflowState.progress['all'] > 0" :min="0" :max="workflowState.progress['all']"
              valueColor="Green" v-model="workflowState.progress['completed']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center mx-4">Completed</span>
          </div>
          <div class="col-2 p-2">
            <Knob v-if="workflowState.progress['all'] > 0" :min="0" :max="workflowState.progress['all']" valueColor="Red"
              v-model="workflowState.progress['failed']" :size="120" readonly :strokeWidth="5" />
            <span class="justify-content-center mx-4">Failed</span>
          </div>
        </div>
      </div>


    </div>

    <div class="card-body my-5" v-if="Object.keys(workflowState.runningProcesses).length > 0">
      <h5 class="card-title">Currently running</h5>

      <div class="card-body my-4">
        <div class="row my-3">
          <div class="col-6">
            <MultiSelect v-model="filterState.selectedRunningProcesses" :options="filterState.availableProcesses"
              v-on:change="runningProcessSelectionChanged();" :showToggleAll=false filter placeholder="Select Processes"
              display="chip" class="md:w-20rem" style="max-width: 40vw" optionLabel="name"
              :disabled="filterState.autoselectAllRunningProcesses">
            </MultiSelect>
          </div>
          <div class="col-3">
            <Button :disabled="filterState.autoselectAllRunningProcesses" v-on:click="unselectAllRunningProcesses()"
              label="Deselect all" />
            <Button :disabled="filterState.autoselectAllRunningProcesses" v-on:click="selectAllRunningProcesses()"
              label="Select all" />
          </div>
          <div class="col-3">
            <ToggleButton id="metricSelectButton" v-model="filterState.autoselectAllRunningProcesses"
              onLabel="Autoupdate enabled" offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionRunning()"
              onIcon="pi pi-check" offIcon="pi pi-times" v-on:change="runningProcessAutoSelectionChanged()" />
          </div>
        </div>
        <div class="row my-3">
          <div class="col-6">
            <MultiSelect v-model="filterState.selectedRunningTags" :options="filterState.availableTags"
              v-on:change="runningTagSelectionChanged();" :showToggleAll=false filter placeholder="Select Tag" display="chip"
              class="md:w-20rem" style="max-width: 40vw" optionLabel="name" :disabled="filterState.autoselectAllRunningTags">
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
            <Button :disabled="filterState.autoselectAllRunningTags" v-on:click="unselectAllRunningTags()"
              label="Deselect all" />
            <Button :disabled="filterState.autoselectAllRunningTags" v-on:click="selectAllRunningTags()" label="Select all" />
          </div>
          <div class="col-3">
            <ToggleButton id="metricSelectButton" v-model="filterState.autoselectAllRunningTags" onLabel="Autoupdate enabled"
              offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionRunningTags()" onIcon="pi pi-check"
              offIcon="pi pi-times" v-on:change="runningTagAutoSelectionChanged()" />
          </div>
        </div>
  
  
      </div>

    
      <div v-for="(info, process) in workflowState.filteredRunningProcesses" class="row my-2">
        <div class="col-auto"><strong>{{ process }}</strong> - {{ info.length > 1 ?
          info.length + ' processes' : '1 process' }} with tags : </div>
        <div class="mx-1 col-auto" v-for="proc_l of info">
          <div v-for="proc of proc_l">
            <Tag v-for="tag_elem of proc.tag"
              :value="Object.keys(tag_elem)[0] === '' ? 'Empty Tag' : Object.keys(tag_elem)[0] + ': ' + Object.values(tag_elem)[0]"></Tag>
          </div>
      </div>
        
      </div>
    </div>

    <div class="my-5 py-2"
      v-if="workflowState.token_info_requested && workflowState.processObjects?.length > 0 && !workflowState.error_on_request">
      <hr>
      <h5 class="card-title">By process</h5>
  
      <div class="my-3">
      
        <!-- also check if this can be made better-->
        <Panel class="my-2" header="Progress by process" toggleable collapsed :pt="{
          header: { style: { 'max-height': '50px' } },
          root: { class: 'mt-1 mb-1' }
        }">
        <div class="row my-2 py-2">
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
        <ul class="list-group list-group-flush justify-content-end">
        <li v-for="(info, process) in workflowState.filteredProgressProcesses" class="p-2 list-group-item d-flex justify-content-between align-items-center">
          <span class="float-left"><strong>{{process}}</strong></span><span class="float-right">{{ processNumbers(info) }} processes complete</span>
        </li>
      </ul>
      </Panel>
        
      </div>


      <hr>
      <div class="card-body my-5" id="process_information_div">
        <h3 class="card-title">Process Information for {{ workflowState.selectedRun }} </h3>
        <div class=m-4></div>
        <DataTable :value="workflowState.processObjects" sortField="task_id" :sortOrder="1" v-model:filters="filters"
          filterDisplay="row" tableStyle="min-width: 50rem" paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]"
          :rowClass="rowClass" removableSort>
          <Column field="task_id" header="Task-ID" sortable :frozen="true"></Column>
          <Column header="Problematic" sortable field="problematic" :sort-field="isProblematic" :frozen="true">
            <template #body="{ data }">
              <Tag v-if="isProblematic(data)" value="Problematic" severity="danger"></Tag>
            </template>
          </Column>
          <Column field="process" header="Process" style="min-width: 20rem" sortable :show-filter-menu="false"
            filter-field="process" :frozen="true">
            <template #filter="{ filterModel, filterCallback }">
              <InputText v-model="filterModel.value" type="text" @input="filterCallback()" class="p-column-filter"
                placeholder="Search by process" />
            </template>
            <template #body="{ data }">
              <span>{{ getSuffix(data.process) }}</span>
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


          <Column field="tag" header="Tag" style="min-width: 20rem" :show-filter-menu="false" sortable>
            <template #filter="{ filterModel, filterCallback }">
              <MultiSelect v-model="filterModel.value" :options="filterState.availableTags" :showToggleAll=false filter
                placeholder="Select Tag" @change="filterCallback()" display="chip" class="md:w-20rem"
                style="max-width: 40vw" optionLabel="name">
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
              <Tag v-for="(tag, id) of data.tag"
                :value="Object.keys(tag)[0] === '' ? 'Empty tag' : Object.keys(tag)[0] + ': ' + Object.values(tag)[0]">
              </Tag>
            </template>
          </Column>
          <Column field="attempt" header="Attempts" sortable>
          </Column>
          <Column field="timestamp" header="Timestamp" sortable></Column>
          <Column field="duration" sortable header="Duration">
            <template #body="{ data }">
              <span v-if="data.duration">{{ getDynamicDurationType(data.duration) }} </span>
              <span v-else>No data</span>
            </template>

          </Column>
          <Column field="cpus" header="Requested CPUs" sortable></Column>
          <Column field="cpu_percentage" header="CPU %" style="min-width: 150px;" sortable>
            <template #body="{ data }">
              <span v-if="data['cpu_percentage']">
                {{ data["cpu_percentage"].toFixed(2) }} %</span>
              <span v-else>No data</span>

            </template>

          </Column>
          <Column header="CPU allocation" sortable field="allocation" :sort-field="allocationSort">
            <template #body="{ data }">
              <span v-if="data['cpu_percentage'] && data['cpus']">
                {{ (data['cpu_percentage'] / data['cpus']).toFixed(2) }} %
              </span>
            </template>
          </Column>
          <Column field="memory_percentage" header="Memory %" sortable>
            <template #body="{ data }">
              <span v-if="data.memory_percentage">
                {{ data.memory_percentage }} %
              </span>
              <span v-else>
                No Data
              </span>
            </template>
          </Column>
          <Column></Column>
          <Column field="memory" header="Requested Memory" sortable>
            <template #body="{ data }">
              <span v-if="data.memory">{{ reasonableDataFormat(data.memory) }}</span>
              <span v-else>No Data</span>
            </template>
          </Column>
          <Column field="rss" header="rss" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data.rss) }}
            </template>
          </Column>
          <Column field="peak_rss" header="Peak rss" sortable>
            <template #body="{ data }">
              <span v-if="data.peak_rss">{{ reasonableDataFormat(data.peak_rss) }}</span>
              <span v-else>No Data</span>
            </template>
          </Column>

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
          <Column field="disk" header="Disk" sortable>
            <template #body="{ data }">
              <span v-if="data.disk">
                {{ data.disk }} %
              </span>
              <span v-else>
                No Data
              </span>
            </template>
          </Column>
          <Column field="rchar" header="rchar" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data.rchar) }}

            </template>
          </Column>
          <Column field="wchar" header="wchar" sortable>
            <template #body="{ data }">
              {{ reasonableDataFormat(data.wchar) }}
            </template>
          </Column>
          <Column field="read_bytes" header="Read bytes" sortable></Column>
          <Column field="write_bytes" header="Written bytes" sortable></Column>
          <Column field="syscr" header="syscr" sortable></Column>
          <Column field="syscw" header="syscw" sortable></Column>
          <Column field="vol_ctxt" header="Voluntary context switches" sortable></Column>
          <Column field="inv_ctxt" header="Involuntary cs" sortable></Column>
          <Column field="time" header="Time" sortable>
            <template #body="{ data }">
              {{ data.time / 1000 }} s
            </template>
          </Column>
          <Column field="realtime" header="Realtime" sortable>
            <template #body="{ data }">
              <span v-if=data.realtime>{{ getDynamicDurationType(data.realtime) }}</span>
              <span v-else>No Data</span>
            </template>
          </Column>
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
        </DataTable>
      </div>
    </div>
  </div>

  <div class="card-body my-4" v-if="currentlySelectedWorkflowHasPlottableData()" id="metric_visualization_div">
    <div>
      <h3 class="my-3">Metric Visualizaton</h3>
    </div>
    <div class="card-body my-3">
      <div class="row my-3">
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
      <div class="row my-3">
        <div class="col-6">
          <MultiSelect v-model="filterState.selectedTags" :options="filterState.availableTags"
            v-on:change="metricTagSelectionChanged();" :showToggleAll=false filter placeholder="Select Tag" display="chip"
            class="md:w-20rem" style="max-width: 40vw" optionLabel="name" :disabled="filterState.autoselectAllMetricTags">
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
          <Button :disabled="filterState.autoselectAllMetricTags" v-on:click="selectAllMetricTags()" label="Select all" />
        </div>
        <div class="col-3">
          <ToggleButton id="metricSelectButton" v-model="filterState.autoselectAllMetricTags" onLabel="Autoupdate enabled"
            offLabel="Autoupdate disabled" :disabled="hideAutoUpdateEnableOptionTags()" onIcon="pi pi-check"
            offIcon="pi pi-times" v-on:change="metricTagAutoSelectionChanged()" />
        </div>
      </div>


    </div>
    <div class="card-body my-4 py-2" id="canvas_area">
      <div class="plot-section">
        <h5>RAM</h5>
        <canvas id="ram_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.memoryChart.resetZoom()"/>
      </div>
      <div class="plot-section">
        <h5>Relative RAM</h5>
        <canvas id="relative_ram_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.relativeMemoryChart.resetZoom()"/>
      </div>
      <div class="plot-section">
        <h5>CPU</h5>
        <canvas id="cpu_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.cpuChart.resetZoom()"/>
      </div>
      <div class="plot-section">
        <h5>CPU Allocation</h5>
        <canvas id="cpu_allocation_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.cpuAllocationChart.resetZoom()"/>
      </div>
      <div class="plot-section">
        <h5>I/O</h5>
        <canvas id="io_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.ioChart.resetZoom()"/>
      </div>
      <div class="plot-section">
        <h5>Duration</h5>
        <canvas id="duration_canvas" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.durationChart.resetZoom()"/>
      </div>
    </div>
    <hr>
  </div>

  <div class="card-body my-4" v-if="currentlySelectedWorkflowHasPlottableData()" id="analysis_div">
    <div class="card-header">
      <h3>Analysis</h3>
    </div>
    <div class="my-4">
      <h5>Settings</h5>
      <p>Below you can adjust the settings for the analyis, e.g. by changing the thresholds to consider.</p>
      <div class="my-3">
        <div class="row p-1">
          <div class="col-4 p-1">
            Top percentage ratio and maximal number of processes <InputSwitch
              v-model="requestState.request_activated['top_percent_ratio']"></InputSwitch>
          </div>
          <div class="col-4 p-1">
            <InputNumber suffix=" %" v-model="requestState.request_params['top_percent_ratio']" :min="0" :max="100" />
          </div>
          <div class="col-4 p-1">
            <InputNumber suffix=" processes" v-model="requestState.request_params['limit_processes_per_domain_by_number']"
              :min="1" :max="15" />
          </div>
        </div>
        <div class="row p-1">
          <div class="col-4 p-1">
            Valid percentage CPU allocation interval <InputSwitch
              v-model="requestState.request_activated['interval_valid_cpu_allocation_percentage']"></InputSwitch>
          </div>
          <div class="col-4 p-1">
            <InputNumber suffix=" %" v-model="requestState.request_params['interval_valid_cpu_allocation_percentage_min']"
              :min="0" :max="95" />
          </div>
          <div class="col-4 p-1">
            <InputNumber suffix=" %" v-model="requestState.request_params['interval_valid_cpu_allocation_percentage_max']"
              :min="96" :max="200" />
          </div>
        </div>
        <div class="row p-1">
          <div class="col-4 p-1">
            Valid percentage CPU allocation interval <InputSwitch
              v-model="requestState.request_activated['interval_valid_ram_relation']"></InputSwitch>
          </div>
          <div class="col-4 p-1">
            <InputNumber suffix=" %" v-model="requestState.request_params['interval_valid_ram_relation_min']" :min="10"
              :max="99" />
          </div>
          <div class="col-4 p-1">
            <InputNumber suffix=" %" v-model="requestState.request_params['interval_valid_ram_relation_max']" :min="101"
              :max="250" />
          </div>
        </div>
      </div>
    </div>
    <hr>
    <div class="card-body my-2" v-if="workflowState.runScores">
      <div class="p-4">
        <h6>Score for this run</h6>
        <div class="my-1" v-if="workflowState.runScores[workflowState.selectedRun]['full_run_score'] > -0.01">
          <div class="row">
            <div class="col-2">
              <strong>{{(workflowState.runScores[workflowState.selectedRun]['full_run_score'] * 100).toFixed(2)}} %</strong>
            </div>
            <div class="col-10">
              <ProgressBar :value="(workflowState.runScores[workflowState.selectedRun]['full_run_score'] * 100).toFixed(0)"></ProgressBar>
            </div>
          </div>
        </div>
        <div class="my-1" v-else>
          <Message>There is no score for this workflow run yet.</Message>
        </div>
      </div>
      <div class="p-4">
        <h6>Score Comparison</h6>
        <div class="my-1" v-for="score_run in sortByScore(workflowState.runScores)">
          <div class="row" v-if="workflowState.runScores[score_run]['full_run_score'] > -0.01">
            <div class="col-2">
              <strong v-if="score_run === workflowState.selectedRun">{{ score_run }} - {{(workflowState.runScores[score_run]['full_run_score'] * 100).toFixed(2)}} %</strong>
              <span v-else>{{ score_run }} - {{(workflowState.runScores[score_run]['full_run_score'] * 100).toFixed(2)}} %</span>
            </div>
            <div class="col-10">
              <ProgressBar :style="{'height': score_run === workflowState.selectedRun ? '12px': '2px'}"
              :value="(workflowState.runScores[score_run]['full_run_score'] * 100).toFixed(0)"
              :showValue="false"
              ></ProgressBar>
              
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="card-body my-4 py-2" id="analysis_canvas_area">
      <div class="plot-section">
        <h5>CPU-RAM ratio</h5>
        <canvas id="cpu_ram_ratio" class="p-4"></canvas>
        <Button label="Reset zoom" severity="sencondary" size="small" class="m-2" outlined @click="metricCharts.cpuRamRatioChart.resetZoom()"/>
      </div>

    </div>
    <Message severity="info" :closable="false">
      {{ analysisInfo.cpuRamRatioText }}
    </Message>

    <div class="my-4" v-if="workflowState.processAnalysis[workflowState.selectedRun]?.length > 0">
      <h6>Processes</h6>
      <TabView>
        <TabPanel v-for="process in workflowState.processAnalysis[workflowState.selectedRun]" :key="process.process"
          :header="getSuffix(process.process) + ' - Task ' + process.task_id">
          <div v-for="problem in process.problems">
            <Message :closable="false" severity="info">{{ problemToMessage(problem) }}</Message>
          </div>
        </TabPanel>
      </TabView>
    </div>


    <div class="card-body my-4" v-if="workflowState.tagAnalysis[workflowState.selectedRun]?.length > 0">
      <h6>Tags</h6>
      <TabView>
        <TabPanel v-for="tag in workflowState.tagAnalysis[workflowState.selectedRun]" :key="tag.tag"
          :header="tagToString(tag.tag)">
          <div v-for="problem in tag.problems">
            <Message :closable="false" severity="info">{{ problemToMessage(problem) }}</Message>
          </div>
        </TabPanel>
      </TabView>
    </div>

    <div class="card-body my-4">
      <h6>Duration</h6>
      <div v-if="workflowState.fullAnalysis && workflowState.fullAnalysis['bad_duration'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of tasks, which need the most time for execution - from submission to completion.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['bad_duration'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem"
          :rows="workflowState.fullAnalysis['bad_duration'][workflowState.selectedRun].length" class="p-2">
          <Column field="task_id" header="Task-ID"></Column>
          <Column field="process" header="Process">
            <template #body="{ data }">
              {{ getSuffix(data['process']) }}
            </template>
          </Column>
          <Column field="tag" header="Tags">
            <template #body>
              Needs to be added
            </template>
          </Column>
          <Column field="duration" header="Duration" sortable>
            <template #body="{ data }">
              <span v-if="data['duration']">
                {{ getDynamicDurationType(data['duration']) }}
              </span>
              <span v-else>No data</span>
            </template>
          </Column>

        </DataTable>
      </div>
      <div
        v-if="workflowState.fullAnalysis && workflowState.fullAnalysis['worst_duration_sum'][workflowState.selectedRun]">
        <Message>
          Below is a list of processes which need the most time summarized over all instances of this process.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['worst_duration_sum'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem"
          :rows="workflowState.fullAnalysis['worst_duration_sum'][workflowState.selectedRun].length">
          <Column field="process" header="Process">
            <template #body="{ data }">
              {{ getSuffix(data['process']) }}
            </template>
          </Column>
          <Column field="duration" header="Duration summarized" sortable>
            <template #body="{ data }">
              {{ getDynamicDurationType(data['duration']) }}
            </template>
          </Column>
        </DataTable>
      </div>

      <div
        v-if="workflowState.fullAnalysis && workflowState.fullAnalysis['worst_duration_average'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of processes which need the most time, averaged for all process instances.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['worst_duration_average'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem"
          :rows="workflowState.fullAnalysis['worst_duration_average'][workflowState.selectedRun].length" class="p-2">
          <Column field="process" header="Process">
            <template #body="{ data }">
              {{ getSuffix(data['process']) }}
            </template>
          </Column>
          <Column field="duration" header="Duration in average" sortable>
            <template #body="{ data }">
              {{ getDynamicDurationType(data['duration']) }}
            </template>
          </Column>
        </DataTable>
      </div>

      <div v-else>
        <Message severity="info">There currently is no information to show regarding the duration of processes</Message>
      </div>
    </div>

    <div class="card-body my-4">
      <h6>CPU </h6>
      <div v-if="workflowState.fullAnalysis && workflowState.fullAnalysis['least_cpu'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of processes which have the lowest CPU allocation percentage. <a
            href="https://www.nextflow.io/docs/latest/metrics.html#cpu-usage" rel="noopener noreferrer" target="_blank"
            class="alert-link">See here for calculation details.</a>
        </Message>
        <DataTable :value="workflowState.fullAnalysis['least_cpu'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem" :rows="workflowState.fullAnalysis['least_cpu'][workflowState.selectedRun].length"
          class="p-2">
          <Column field="task_id" header="Task-ID"></Column>
          <Column field="process" header="Process">
            <template #body="{ data }">
              {{ getSuffix(data['process']) }}
            </template>
          </Column>
          <Column field="allocation" header="CPU allocation %" sortable>
            <template #body="{ data }">
              {{ data["allocation"].toFixed(2) }} %
            </template>
          </Column>
        </DataTable>
      </div>
      <div v-if="workflowState.fullAnalysis && workflowState.fullAnalysis['most_cpu'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of processes which have the highest CPU allocation percentage. <a
            href="https://www.nextflow.io/docs/latest/metrics.html#cpu-usage" rel="noopener noreferrer" target="_blank"
            class="alert-link">See here for calculation details.</a>
        </Message>
        <DataTable :value="workflowState.fullAnalysis['most_cpu'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem" :rows="workflowState.fullAnalysis['most_cpu'][workflowState.selectedRun].length"
          class="p-2">
          <Column field="task_id" header="Task-ID"></Column>
          <Column field="process" header="Process">
            <template #body="{ data }">
              {{ getSuffix(data['process']) }}
            </template>
          </Column>
          <Column field="allocation" header="CPU allocation" sortable>
            <template #body="{ data }">
              {{ data["allocation"].toFixed(2) }} %
            </template>
          </Column>
        </DataTable>
      </div>
      <div v-else>
        <Message severity="info">There currently is no information to show regarding the CPU allocation of processes
        </Message>
      </div>
    </div>

    <div class="card-body my-4">
      <h6>Memory</h6>
      <div
        v-if="workflowState.fullAnalysis && workflowState.fullAnalysis['least_memory_allocation_average'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of processes which have the lowest Memory allocation percentage in average over all process
          instances.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['least_memory_allocation_average'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem"
          :rows="workflowState.fullAnalysis['least_memory_allocation_average'][workflowState.selectedRun].length"
          class="p-2">
          <Column field="process" header="Process">
            <template #body="{ data }">
              {{ getSuffix(data['process']) }}
            </template>
          </Column>
          <Column field="memory_allocation" header="Memory Allocation % average" sortable>
            <template #body="{ data }">
              {{ (data["memory_allocation"] * 100).toFixed(2) }} %
            </template>
          </Column>
        </DataTable>
      </div>
      <div
        v-if="workflowState.fullAnalysis && workflowState.fullAnalysis['most_memory_allocation_average'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of processes which have the highest Memory allocation percentage in average over all process
          instances.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['most_memory_allocation_average'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem"
          :rows="workflowState.fullAnalysis['most_memory_allocation_average'][workflowState.selectedRun].length"
          class="p-2">
          <Column field="process" header="Process">
            <template #body="{ data }">
              {{ getSuffix(data['process']) }}
            </template>
          </Column>
          <Column field="memory_allocation" header="Memory Allocation % average" sortable>
            <template #body="{ data }">
              {{ (data["memory_allocation"] * 100).toFixed(2) }} %
            </template>
          </Column>
        </DataTable>
      </div>
      <div
        v-if="workflowState.fullAnalysis && workflowState.fullAnalysis['worst_memory_relation_average'][workflowState.selectedRun]"
        class="my-3">
        <Message>
          Below is a list of processes which have the worst values regarding the ratio between physical memory and the
          combined total of physical memory and swap space utilization.
        </Message>
        <DataTable :value="workflowState.fullAnalysis['worst_memory_relation_average'][workflowState.selectedRun]"
          tableStyle="min-width: 50rem"
          :rows="workflowState.fullAnalysis['worst_memory_relation_average'][workflowState.selectedRun].length"
          class="p-2">
          <Column field="process" header="Process">
            <template #body="{ data }">
              {{ getSuffix(data['process']) }}
            </template>
          </Column>
          <Column field="memory_relation" header="Ratio (physical/vmem) in %" sortable>
            <template #body="{ data }">
              {{ (data["memory_relation"] * 100).toFixed(2) }} %
            </template>
          </Column>
        </DataTable>
      </div>
      <div v-else>
        <Message severity="info">There currently is no information to show regarding the memory allocation of processes
        </Message>
      </div>
    </div>

    <div class="card-body" v-if="Object.keys(workflowState.processesByRun).length > 1">
      <h6>Comparisson</h6>
      <Message severity="info">Please select two workflow runs to compare</Message>
      <div class="row">

        <!--<div class="col-6">
            <Dropdown v-model="analysisState" editable :options="cities" optionLabel="name" placeholder="Select a City" class="w-full md:w-14rem" />
          </div>
          <div class="col-6">
            <Dropdown v-model="selectedCity" editable :options="cities" optionLabel="name" placeholder="Select a City" class="w-full md:w-14rem" />
          </div> -->
      </div>
    </div>



  </div>
  <hr>
  <div class="card-body my-4" v-if="workflowState.error_on_request">
    <div class="alert alert-info">
      This token is not correct, please enter another token
    </div>
  </div>
  <div class="card-body my-4" v-if="workflowState.token_info_requested && !workflowState.error_on_request">
    <div type="button" class="btn btn-outline-danger" @click="confirmDeletion();">
      Delete token
    </div>

  </div>
  <Sidebar v-model:visible="uiState.sidebarVisible" :pt="{
          closeButton : { class: 'd-none'}
      }">
  <template #header>
    <div class="row justify-content-end">
      <div class="col-auto">
        <h5 class="mt-2">Navigate</h5>
      </div>
      <div class="col-auto">
        <Button size="small" icon="pi pi-arrow-left" label="Close" @click="changeSidebarState(false)"></Button>
      </div>
    </div>
  </template>
  <ul class="list-group list-group-flush">
    <li class="list-group-item list-group-item-action nav-lg-item" id="run-selection-nav-item"
      @click="goToDiv('run_selection_div')">Run Selection</li>
    <li class="list-group-item list-group-item-action nav-lg-item" id="progress-nav-item"
      @click="goToDiv('progess_summary_div')">Progress</li>
    <li class="list-group-item list-group-item-action nav-lg-item" id="process-information-nav-item"
      @click="goToDiv('process_information_div')">Process Information</li>
    <li class="list-group-item list-group-item-action nav-lg-item" id="metric-nav-item"
      @click="goToDiv('metric_visualization_div')">Metric Visualizaton</li>
    <li class="list-group-item list-group-item-action nav-lg-item" id="analysis-nav-item"
      @click="goToDiv('analysis_div')">Analysis</li>
  </ul>


</Sidebar>

<ScrollTop />
<Toast position="center" />
<ConfirmDialog></ConfirmDialog></template>

<style scoped></style>
