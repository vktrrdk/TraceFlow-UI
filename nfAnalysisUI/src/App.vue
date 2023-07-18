<script lang="ts">

import {defineComponent, reactive, toRefs} from "vue";
import 'bootstrap'
import 'bootstrap/dist/css/bootstrap-grid.min.css'
import 'bootstrap/dist/js/bootstrap.min.js'
import 'bootstrap/dist/css/bootstrap.min.css'
import axios from "axios";
import { useRouter } from "vue-router";

//import { UserComponent } from "./components/userComponent/userComponent.vue"


const router = useRouter();
export default defineComponent({


    name: 'App',
    components: {},

});
</script>

<template>
    <div class="container-fluid m-4">
        <router-view></router-view>
    </div>
    



</template>

<style scoped>

</style>


