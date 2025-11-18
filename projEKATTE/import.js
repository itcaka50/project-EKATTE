import fs from 'fs/promises';
import pool from './db.js';
import Ajv from 'ajv';
import { PropertyMixer } from 'three';

const Ajv = new Ajv();

const regionSchema = { type: 'object',
    properties : { code : {type : 'string'}, name : {type : 'string'} },
    required : ['code', 'name'] };
const validateRegion = Ajv.compile(regionSchema);

const municipalitySchema = { type : 'object',
    properties : { code : {type : 'string'}, name : {type : 'string'}, region_code : {type : 'string'} },
    required : ['code', 'name', 'region_code'] };
const validateMunicipality = Ajv.compile(municipalitySchema);

const townhallSchema = { type : 'object',
    properties : { code : {type : 'string'}, name : {type : 'string'}, municipality_code : {type : 'string'} },
    required : ['code', 'name', 'municipality_code'] };
const validateTownHall = Ajv.compile(townhallSchema);

const territorialunitsSchema = { type : 'object',
    properties : { ekatte : {type : 'string'}, name : {type : 'string'}, type : {type : 'string'}, town_hall_code : {type : 'string'} },
    required : ['ekatte', 'name', 'town_hall_code'] };
const validateTerritorialUnit = Ajv.compile(territorialunitsSchema);

