// --- tiny helper for defunct check-boxes ---------------------------
const el = document.getElementById('something');
function safeUncheck(el){
    if (el && typeof el.checked !== "undefined"){ el.checked = false; }
}

var smoothModelLabel = document.getElementById('smooth-model');   // may be null
var shineSlider      = $('#shine');                               // may be empty


// var container = document.getElementById('container');
// var container = document.getElementById('main_viewer');
var container = document.getElementById('app');
var view = document.getElementById('main_viewer');

if (!Detector.webgl) Detector.addGetWebGLMessage();

var camera, camerHelper, scene, renderer, loader,
    stats, controls, transformControls, numOfMeshes = 0, model, modelDuplicate, sample_model, wireframe, mat, scale, delta;

const manager = new THREE.LoadingManager();

var modelLoaded = false, sample_model_loaded = false;
var modelWithTextures = false, fbxLoaded = false, gltfLoaded = false;;
var bg_Texture = false;

var glow_value, selectedObject, composer, effectFXAA, position, outlinePass, ssaaRenderPass;
var clock = new THREE.Clock();

var ambient, directionalLight, directionalLight2, directionalLight3, pointLight, bg_colour;
var backgroundScene, backgroundCamera, backgroundMesh;

var amb = document.getElementById('ambient_light');
var rot1 = document.getElementById('rotation');
var wire = document.getElementById('wire_check');
var model_wire = document.getElementById('model_wire');
var phong = document.getElementById('phong_check');
var xray = document.getElementById('xray_check');
var glow = document.getElementById('glow_check');
var grid = document.getElementById('grid');
var polar_grid = document.getElementById('polar_grid');
var axis = document.getElementById('axis');
var bBox = document.getElementById('bBox');

var transform = document.getElementById('transform');
var smooth = document.getElementById('smooth');
var outline = document.getElementById('outline');

var panBtn = document.getElementById('vc_pan');             // Pan toggle
var displayRadios = document.querySelectorAll('input[name="display_mode"]');


const statsNode = document.getElementById('stats') || { innerHTML:'' };



//ANIMATION GLOBALS
var animations = {}, animationsSelect = document.getElementById("animationSelect"),
animsDiv = document.getElementById("anims"), mixer, currentAnimation, actions = {};

//X-RAY SHADER MATERIAL
//http://free-tutorials.org/shader-x-ray-effect-with-three-js/
var materials = {
    solidMaterial  : new THREE.MeshLambertMaterial({ color:0x888888, side:THREE.DoubleSide }),
    shadedMaterial : new THREE.MeshPhongMaterial  ({ color:0x666666, shininess:30, side:THREE.DoubleSide }),
    renderedMaterial: new THREE.MeshStandardMaterial({ color:0x888888, metalness:0.3, roughness:0.6, side:THREE.DoubleSide }),
    default_material: new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
    default_material2: new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
    wireframeMaterial: new THREE.MeshPhongMaterial({
        side: THREE.DoubleSide,
        wireframe: true, 
        shininess: 100,
        specular: 0x000, emissive: 0x000,
        flatShading: false, depthWrite: true, depthTest: true
    }),
    wireframeMaterial2: new THREE.LineBasicMaterial({ wireframe: true, color: 0xffffff }),
    wireframeAndModel: new THREE.LineBasicMaterial({ color: 0xffffff }),
    phongMaterial: new THREE.MeshPhongMaterial({
        color: 0x555555, specular: 0xffffff, shininess: 10,
        flatShading: false, side: THREE.DoubleSide, skinning: true
    }),
    xrayMaterial: new THREE.ShaderMaterial({
        uniforms: {
            p: { type: "f", value: 3 },
            glowColor: { type: "c", value: new THREE.Color(0x84ccff) },
        },
        vertexShader: document.getElementById('vertexShader').textContent,
        fragmentShader: document.getElementById('fragmentShader').textContent,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false
    })
    
};

var clock = new THREE.Clock();
var winDims = [window.innerWidth * 0.8, window.innerHeight * 0.89]; //size of renderer

/* turn “Dinosaur_V02.obj” into “dinosaur_v02”  */
function norm(str){
  return str
      .toLowerCase()          
      .replace(/\.[^/.]+$/, '')   
      .replace(/[^a-z0-9]+/g, '_') 
      .replace(/^_+|_+$/g,'');    
}

/* ───────── URL → sample-index helper ───────── */

function getRequestedModel() {
  const url   = new URL(window.location.href);

  /* explicit query strings */
  if (url.searchParams.has('idx'))   return { kind:'index', val:url.searchParams.get('idx') };
  if (url.searchParams.has('model')) return { kind:'name',  val:url.searchParams.get('model') };

    /* bare paths – handles /bear, /view/bear, /view/model=bear, /view/idx=2 */
    const path = url.pathname.replace(/^\/+|\/+$/g,'');   
    if (path && path !== 'index.html') {

        const parts = path.split('/');                    // 'view','model=bear'
        let last     = parts[parts.length - 1];           // 'model=bear'

        /* allow 'model=bear' or 'idx=3' in the path */
        if (last.startsWith('model=')) {
            return { kind:'name',  val: last.slice(6) };  // after 'model='
        }
        if (last.startsWith('idx=')) {
            return { kind:'index', val: parseInt(last.slice(4),10) };
        }

        /* plain bare file name, e.g. 'bear.obj' -> 'bear' */
        return { kind:'name', val: last.split('.')[0] };
    }
  return null;
}

function findModelIndex(req){
  if(!req) return -1;

  /* numeric index? */
  if(req.kind === 'index' && /^\d+$/.test(req.val)){
      const n = +req.val;
      return (n>=0 && n < modelList.length) ? n : -1;
  }

  /* compare normalised strings */
  const canon = norm(req.val);
  return modelList.findIndex(m =>
      canon === norm(m.id   || '') ||
      canon === norm(m.name || '') ||
      canon === norm( (m.url||'').split('/').pop() )   // filename
  );
}



function onload() {

    //window.addEventListener('resize', onWindowResize, false);
    // switchScene(0);
    const wanted = findModelIndex( getRequestedModel() );
    switchScene( wanted !== -1 ? wanted : 0 );
    animate();
}

/* ------------------------------------------------------------------
   VIEW-CONTROL HELPERS  
--------------------------------------------------------------------*/

/* Full-screen simply clicks the existing icon */
function vc_fullscreen(){
    if ( !THREEx.FullScreen.activated() ) {
        THREEx.FullScreen.request( container ); 
    } else {
        THREEx.FullScreen.cancel(); 
    }
}

/* Fit the current object tightly inside the frustum */
/* — Fit view (scale-aware) — */
function vc_fit(){
  const obj =  (modelLoaded && model) || (sample_model_loaded && sample_model);
  if(!obj || !camera) return;

  /* radius AFTER current scaling — not the original geometry */
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3()).length();
  const centre = box.getCenter(new THREE.Vector3());

  /* how far the camera must be so the whole diagonal fits */
  const halfFovY = THREE.Math.degToRad(camera.fov * 0.5);
  const dist     = (size * 0.5) / Math.tan(halfFovY); // 0.5 = radius

  camera.position.copy(centre).add(new THREE.Vector3(0,0,dist));
  controls.target.copy(centre);
  controls.update();
}


/* manual dolly that works in every OrbitControls build */
function vc_dolly(factor){
    const offset = new THREE.Vector3()
        .subVectors( camera.position, controls.target )
        .multiplyScalar( factor );

    camera.position.copy( controls.target ).add( offset );
    controls.update();
}
function vc_zoomIn (){ vc_dolly(0.8 ); }   // 20 % closer
function vc_zoomOut(){ vc_dolly(1.25); }   // 25 % farther

/* Reset to original pose */
const _homePos = new THREE.Vector3(0,0,20);
function vc_reset(){
    camera.position.copy(_homePos);
    camera.up.set(0,1,0);
    controls.target.set(0,0,0);
    controls.update();
}

/* attach the handlers once DOM is ready */
document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('vc_full') .addEventListener('click', vc_fullscreen);
    const fitBtn = document.getElementById('vc_fit');
    if (fitBtn) fitBtn.addEventListener('click', vc_fit);
    document.getElementById('vc_zi')   .addEventListener('click', vc_zoomIn);
    document.getElementById('vc_zo')   .addEventListener('click', vc_zoomOut);
    document.getElementById('vc_reset').addEventListener('click', vc_reset);
    if (panBtn){
    panBtn.addEventListener('click', ()=>{
        controls.enablePan = !controls.enablePan;
        panBtn.textContent = controls.enablePan ? 'Pan ON' : 'Pan OFF';
    });
    panBtn.textContent = 'Pan OFF';          // start disabled
}
    
});


function initScene(index) {

    manager.setURLModifier(null); 
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500000);
    camera.position.set(0, 0, 20);

    //Setup renderer
    renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setClearColor(0x292121);

    const view = document.getElementById('main_viewer');
    view.appendChild(renderer.domElement);




    // 3 helper
    function resizeRenderer(){
        renderer.setPixelRatio(window.devicePixelRatio); 
        const w = view.clientWidth;
        const h = view.clientHeight || 300;   // fallback for 0-height if hidden
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
     resizeRenderer();
         // 2  listen for any size change (window or flex parent)
    window.addEventListener('resize', resizeRenderer, false);


    THREEx.WindowResize(renderer, camera);

    function toggleFullscreen(elem) {
        elem = elem || document.documentElement;
        if (!document.fullscreenElement && !document.mozFullScreenElement &&
            !document.webkitFullscreenElement && !document.msFullscreenElement) {

            THREEx.FullScreen.request(container);

        }
        else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
                //renderer.setSize(winDims[0], winDims[1]); //Reset renderer size on fullscreen exit
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
                //renderer.setSize(winDims[0], winDims[1]);
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
               // renderer.setSize(winDims[0], winDims[1]);
            }
        }
    }


    const fsBtn = document.getElementById('fullscreenBtn');
    if (fsBtn) fsBtn.addEventListener('click', () => toggleFullscreen());
  
    ambient = new THREE.AmbientLight(0x404040);
    $('#ambient_light').change(function () {
        if (amb.checked) {
            scene.add(ambient);
        }
        else {
            scene.remove(ambient);
        }
    });

    /*LIGHTS*/
    directionalLight = new THREE.DirectionalLight(0xffeedd);
    directionalLight.position.set(0, 0, 1).normalize();
    scene.add(directionalLight);

    directionalLight2 = new THREE.DirectionalLight(0xffeedd);
    directionalLight2.position.set(0, 0, -1).normalize();
    scene.add(directionalLight2);

    directionalLight3 = new THREE.DirectionalLight(0xffeedd);
    directionalLight3.position.set(0, 1, 0).normalize();
    scene.add(directionalLight3);

    var ambientLight = new THREE.AmbientLight(0x808080, 0.2); //Grey colour, low intensity
    scene.add(ambientLight);

    pointLight = new THREE.PointLight(0xcccccc, 0.5);
    camera.add(pointLight);

    scene.add(camera);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.rotateSpeed = 0.09;

    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    transformControls.addEventListener('change', render);
    scene.add(transformControls);

    transformControls.addEventListener('mouseDown', function () {
        controls.enabled = false;
    });
    transformControls.addEventListener('mouseUp', function () {
        controls.enabled = true;
    });

    window.addEventListener('keydown', function (event) {

        switch (event.keyCode) {

            case 82: // R key pressed - set rotate mode
                transformControls.setMode("rotate");
                break;

            case 84: // T key pressed - set translate mode
                transformControls.setMode("translate");
                break;

            case 83: // S key pressed - set scale mode
                transformControls.setMode("scale");
                break;
        }

    });

    //Colour changer, to set background colour of renderer to user chosen colour
    $(".bg_select").spectrum({
        color: "#fff",
        change: function (color) {
            $("#basic_log").text("Hex Colour Selected: " + color.toHexString()); //Log information
            var bg_value = $(".bg_select").spectrum('get').toHexString(); //Get the colour selected
            renderer.setClearColor(bg_value); //Set renderer colour to the selected hex value
            ssaaRenderPass.clearColor = bg_value;
            document.body.style.background = bg_value; //Set body of document to selected colour           
        }
    });

    // postprocessing    
    var renderPass = new THREE.RenderPass( scene, camera );

    var fxaaPass = new THREE.ShaderPass( THREE.FXAAShader );
    var pixelRatio = renderer.getPixelRatio();

    fxaaPass.material.uniforms[ 'resolution' ].value.x = 1 / ( window.innerWidth * pixelRatio );
    fxaaPass.material.uniforms[ 'resolution' ].value.y = 1 / ( window.innerHeight * pixelRatio );
    fxaaPass.renderToScreen = true;

    outlinePass = new THREE.OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);   
    outlinePass.edgeStrength = 1.5; 
    outlinePass.edgeGlow = 2;

    composer = new THREE.EffectComposer( renderer );
    composer.addPass( renderPass );
    composer.addPass(outlinePass);
    composer.addPass( fxaaPass );
    
    /*LOAD SAMPLE MODELS*/
    var sceneInfo = modelList[index]; //index from array of sample models in html select options
    loader = new THREE.OBJLoader(manager);
    var url = sceneInfo.url;

    //progress/loading bar
    var onProgress = function (data) {
        if (data.lengthComputable) { //if size of file transfer is known
            var percentage = Math.round((data.loaded * 100) / data.total);
            console.log(percentage);
            if (statsNode) {
                statsNode.innerHTML = 'Loaded : ' + percentage + '%' + ' of ' + sceneInfo.name
            + '<br>'
            + '<progress value="0" max="100" class="progress"></progress>';
            $('.progress').css({ 'width': percentage + '%' });
            $('.progress').val(percentage);;
            }       
        }
    }
    var onError = function (xhr) {
        console.log('ERROR');
    };

    loader.load(url, function (data) {

        sample_model = data;
        sample_model_loaded = true;

        console.log(sample_model);

        sample_model.traverse(function (child) {
            if (child instanceof THREE.Mesh) {

                numOfMeshes++;
                var geometry = child.geometry;
                stats(sceneInfo.name, geometry, numOfMeshes);
                
                child.material = materials.default_material;

                var wireframe2 = new THREE.WireframeGeometry(child.geometry);
                var edges = new THREE.LineSegments(wireframe2, materials.wireframeAndModel);
                materials.wireframeAndModel.visible = false;
                sample_model.add(edges);

                setWireFrame(child);
                setWireframeAndModel(child);

                setPhong(child);
                setXray(child);

            }
        });

        setCamera(sample_model);

        setSmooth(sample_model);

        setBoundBox(sample_model);
        setPolarGrid(sample_model);
        setGrid(sample_model);
        setAxis(sample_model);

        scaleUp(sample_model);
        scaleDown(sample_model);

        selectedObject = sample_model;
        outlinePass.selectedObjects = [selectedObject];
        outlinePass.enabled = false;

        scene.add(sample_model);

    }, onProgress, onError);


    $('#transform').on('change', function () {
        
        if (transform.checked) {
            document.getElementById('transformKey').style.display = 'block';
            if (modelLoaded) {
                transformControls.attach(model);
            }
            else if(sample_model_loaded) {
                transformControls.attach(sample_model);
            }
            
        } else {
            document.getElementById('transformKey').style.display = 'none';
            transformControls.detach(scene);
        }
    });
}




function removeModel() {

    scene.remove(model);
    scale = 1;
    numOfMeshes = 0;
    modelLoaded = false;
    modelWithTextures = false;
    fbxLoaded = false;
    gltfLoaded = false;
    
    if (ambient) {
        scene.remove(ambient);
    }
    
    $('#point_light').slider("value", 0.5);
    pointLight.intensity = 0.5;

    camera.position.set(0, 0, 20); //Reset camera to initial position
    controls.reset(); //Reset controls, for when previous object has been moved around e.g. larger object = larger rotation
    statsNode.innerHTML = ''; //Reset stats box (faces, vertices etc)

    $("#red, #green, #blue, #ambient_red, #ambient_green, #ambient_blue").slider("value", 127); //Reset colour sliders

    safeUncheck(amb);           safeUncheck(rot1);        safeUncheck(wire);
    safeUncheck(model_wire);    safeUncheck(phong);       safeUncheck(xray);
    safeUncheck(glow);          safeUncheck(grid);        safeUncheck(polar_grid);
    safeUncheck(axis);          safeUncheck(bBox);        safeUncheck(smooth);
    safeUncheck(transform);
    
    transformControls.detach(scene);

    if (smoothModelLabel)
    smoothModelLabel.innerHTML = "Smooth Model";

    $('#rot_slider').slider({
        disabled: true //disable the rotation slider
    });
    controls.autoRotate = false; //Stop model auto rotating if doing so on new file select
    if (shineSlider.length && shineSlider.hasClass('ui-slider'))
    shineSlider.slider("value", 10); //Set phong shine level back to initial

    $('input[name="rotate"]').prop('checked', false); //uncheck rotate x, y or z checkboxes
    
    animsDiv.style.display = "none"; //Hide animation <div>
}

$('#remove').click(function () {
    removeModel();
});

$("#red, #green, #blue, #ambient_red, #ambient_green, #ambient_blue").slider({
    change: function (event, ui) {
        console.log(ui.value);
        render();
    }
});

var rotVal = [40, 80, 110, 140, 170, 200, 240, 280, 340, 400, 520]; //Rotation speeds low - high
var rotation_speed;

$("#rot_slider").slider({
    orientation: "horizontal",
    range: "min",
    max: rotVal.length - 1,
    value: 0,
    disabled: true,
    slide: function (event, ui) {
        rotation_speed = rotVal[ui.value]; //Set speed variable to the current selected value of slider
    }
});

$('#rotation').change(function () {
    if (rot1.checked) {
        rotation_speed = rotVal[$("#rot_slider").slider("value")];
        //set the speed to the current slider value on initial use
        controls.autoRotate = true;

        $("#rot_slider").slider({
            disabled: false,
            change: function (event, ui) {
                console.log(rotVal[ui.value]);
                controls.autoRotate = true;
                controls.autoRotateSpeed = delta * rotation_speed;
            }
        });
    }
    else {
        controls.autoRotate = false;
        $('#rot_slider').slider({
            disabled: true //disable the slider from being able to rotate object when rotation toggle is off
        });
    }
});

function setColours() {

    var colour = getColours($('#red').slider("value"), $('#green').slider("value"), $('#blue').slider("value"));
    directionalLight.color.setRGB(colour[0], colour[1], colour[2]);
    directionalLight2.color.setRGB(colour[0], colour[1], colour[2]);
    directionalLight3.color.setRGB(colour[0], colour[1], colour[2]);

    var colour = getColours($('#ambient_red').slider("value"), $('#ambient_green').slider("value"),
                            $('#ambient_blue').slider("value"));
    ambient.color.setRGB(colour[0], colour[1], colour[2]);

}

function setDisplayMode (mode){
    const root = (modelLoaded && model) || (sample_model_loaded && sample_model);
    if (!root) return;

    root.traverse(child=>{
        if (!(child instanceof THREE.Mesh)) return;

        switch(mode){
            case 'solid':     child.material = materials.solidMaterial;     break;
            case 'shaded':    child.material = materials.shadedMaterial;    break;
            case 'textured':  /* keep whatever the loader gave us */        break;
            case 'material':  child.material = materials.phongMaterial;     break;
            case 'rendered':  child.material = materials.renderedMaterial;  break;
        }
        child.material.needsUpdate = true;
    });
    render();
}


function getColours(r, g, b) {

    var colour = [r.valueOf() / 255, g.valueOf() / 255, b.valueOf() / 255];
    return colour;
}

function render() {

    setColours();
   // renderer.render(scene, camera);
}

displayRadios.forEach(r=>{
    r.addEventListener('change', e=>{
        if (e.target.checked) setDisplayMode(e.target.value);
    });
});


function animate() {

    delta = clock.getDelta();
    requestAnimationFrame(animate);
    
    if (mixer) {
        mixer.update(delta);
    }
    controls.update(delta);
    
    composer.render();
    render();

}

/* -----------------------------------------------------------
   Build modelList at runtime from the /models endpoint
-------------------------------------------------------------*/
let modelList = [];          // will be filled once fetch returns

function titleCase(str){
  return str.charAt(0).toUpperCase() + str.slice(1);
}

fetch('/models')
  .then(r => r.json())
  .then(files => {
      modelList = files.map(f=>{
          const stem = f.replace(/\.[^/.]+$/,'');      // "Tiger.obj" -> "Tiger"
          const id   = stem.toLowerCase();             // tiger
          return {
              id,
              name : `${titleCase(id)} Model`,         // "Tiger Model"
              url  : `sample_models/${f}`
          };
      });

      onload();
  })
  .catch(err => {
      console.error('Could not load /models list', err); //fallback
  });

function switchScene(index) {

    clear();
    initScene(index);
    var elt = document.getElementById('scenes_list');
    elt.selectedIndex = index;

}

function selectModel() {

    var select = document.getElementById("scenes_list");
    var index = select.selectedIndex;

    if (index >= 0) {
        removeModel();     
        switchScene(index);
    }

}

function clear() {

    if (view && renderer) {
        view.removeChild(renderer.domElement);
        document.body.style.background = "#292121";
    }
}




document.querySelectorAll('#top_nav .dropdown > a').forEach(a=>{
  a.addEventListener('click',e=>{
     e.preventDefault();
     const p=a.nextElementSibling;
     p.classList.toggle('hidden');
     // close others
     document.querySelectorAll('.panel:not(.hidden)').forEach(o=>{
        if(o!==p) o.classList.add('hidden');
     });
  });
});
document.addEventListener('click',e=>{
  if(!e.target.closest('.dropdown')) document
      .querySelectorAll('.panel').forEach(p=>p.classList.add('hidden'));
});

function showUserInDropdown(label){
    const select = document.getElementById('scenes_list');

    /* remove the previous user entry (if any) */
    [...select.options].forEach(o=>{
        if(o.dataset.user) select.removeChild(o);
    });

    /* add the new one at the end */
    const opt = document.createElement('option');
    opt.textContent = label + '  (User)';
    opt.dataset.user = '1';          // mark it so we can spot it later
    select.appendChild(opt);
    select.selectedIndex = select.options.length-1;
}

