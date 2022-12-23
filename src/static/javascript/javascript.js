

function populate()
{
    document.getElementById( "rooms_spinner" ).style.display = "block";
    document.getElementById( "colors_spinner" ).style.display = "block";
    
    $.ajax( { url      : "./uniquevalues",
              type     : "GET",
              complete : function( result )
                         {
                             document.getElementById( "rooms_spinner" ).style.display = "none";
                             document.getElementById( "colors_spinner" ).style.display = "none";
                             
                             var result_json = result["responseJSON"];
                             if( !result_json )
                             {
                                 alert( "Unexpected result returned from /uniquevalues" );
                                 return;
                             }
                             
                             var error_str = result_json["error_str"];
                             if( error_str )
                             {
                                 alert( "Looking up /uniquevalues failed:\n\n" + error_str );
                                 return;
                             }
                                 
                             var unique_values = result_json["unique_values"];
                             
                             addRooms(  unique_values["rooms"]  );
                             addColors( unique_values["colors"] );
                             buildQuery();
                             
                         }
                     
        } );

}


function addRooms( values_arr )
{
    var ul = document.getElementById( "rooms_ul" );
    
    for( var i = 0; i < values_arr.length; i++ )
    {
        value      = values_arr[i];
        class_name = "cb_rooms";
        cb_id      = class_name + "_li_" + i.toString();
        
        li = document.createElement( "li" );
        li.innerHTML = "<input type='checkbox' class='" + class_name + "' id='" + cb_id + "' onchange='buildQuery();'><label for='" + cb_id + "'>" + value + "</label>";
        
        ul.appendChild( li );
        document.getElementById( cb_id ).value = value;
    }
    
}


function addColors( values_arr )
{
    var colors_div = document.getElementById( "colors_div" );
    
    for( var i = 0; i < values_arr.length; i++ )
    {
        value = values_arr[i];
        if( !value.match( /FF$/ ) )
        {
            // Don't include transparent background in search
            continue;
        }
        
        swatch_div = document.createElement( "div" );
        swatch_div.className = "swatch_div";
        swatch_div.style.background = value;
        swatch_div.title = value;
        swatch_div.onclick = function( event ){ selectDeselect(this); }
        
        colors_div.appendChild( swatch_div );
    }
    
}


function expandCollapse( btn )
{
    var id = btn.id.replace( /_expandcollapse_btn$/, "" );
    var div = document.getElementById( id + "_div" );
    
    if( "none" == div.style.display )
    {
        div.style.display = "block";
        btn.style.transform = "rotate( 0deg )";
        return;
    }
    
    div.style.display = "none";
    btn.style.transform = "rotate( -90deg )";
    
}


function selectDeselect( swatch_div )
{
    if( swatch_div.innerHTML.match( /check/ ) )
    {
        swatch_div.innerHTML = "";
    }
    else
    {
        swatch_div.innerHTML = "<div class='include_check'>&check;</div>";
    }
    
    buildQuery();
    
}


function buildQuery()
{
    query = "";
    filter = "";
    passages = { "fields" : [] };
    
    // Search-in checkboxes
    var b_room_names      = document.getElementById( "searchin_room_names"     ).checked;
    var b_mural_names     = document.getElementById( "searchin_mural_names"    ).checked;
    var b_text_widgets    = document.getElementById( "searchin_text_widgets"   ).checked;
    var b_shape_widgets   = document.getElementById( "searchin_shape_widgets"  ).checked;
    var b_sticky_widgets  = document.getElementById( "searchin_sticky_widgets" ).checked;
    
    // Query string
    query_str = document.getElementById( "search_text_input" ).value;
    
    if( "" != query_str )
    {
        if( b_room_names )
        {
            passages["fields"].push( "room.name" );
            query += "room.name:" + query_str + "|";
        }
        
        if( b_mural_names )
        {
            passages["fields"].push( "title" );
            query += "title:" + query_str + "|";
        }
        
        if( b_text_widgets )
        {
            passages["fields"].push( "text_arr.text" );
            query += "text_arr.text:" + query_str + "|";
        }
        
        if( b_shape_widgets )
        {
            passages["fields"].push( "shape_arr.text" );
            query += "shape_arr.text:" + query_str + "|";
        }
        
        if( b_sticky_widgets )
        {
            passages["fields"].push( "sticky_arr.text" );
            query += "sticky_arr.text:" + query_str + "|";
        }
        
        query = query.replace( /\|$/, "" );
    }
        
    // Date created filter
    var created_after  = new Date( document.getElementById( "created_after_input"  ).value ).getTime();
    var created_before = new Date( document.getElementById( "created_before_input" ).value ).getTime();
    if( created_after )
    {
        filter += "created>" + created_after + ", ";
    }
    if( created_before )
    {
        filter += "created<" + created_before + ", ";
    }
    
    // Room names
    var room_cb_arr = document.getElementsByClassName( "cb_rooms" );
    var rooms_arr = [];
    for( var i = 0; i < room_cb_arr.length; i++ )
    {
        if( room_cb_arr[i].checked )
        {
            rooms_arr.push( room_cb_arr[i].value );
        }
    }
    if( rooms_arr.length > 0 )
    {
        filter += "room:(";
        for( var i = 0; i < rooms_arr.length; i++ )
        {
            filter += "name::\"" + rooms_arr[i] + "\"| ";
        }
        filter = filter.replace( /\|\s+$/, "" );
        filter += "), ";
    }
    
    // Background colors
    var swatches_arr = document.getElementsByClassName( "swatch_div" );
    var colors_arr = [];
    for( var i = 0; i < swatches_arr.length; i++ )
    {
        if( swatches_arr[i].innerHTML.match( /check/ ) )
        {
            colors_arr.push( swatches_arr[i].title );
        }
    }
    if( colors_arr.length > 0 )
    {
        if( b_text_widgets )
        {
            filter += "text_arr:(backgroundColor::" + colors_arr.join( "|backgroundColor::" ) + ")|";
        }
        if( b_shape_widgets )
        {
            filter += "shape_arr:(backgroundColor::" + colors_arr.join( "|backgroundColor::" ) + ")|";
        }
        if( b_sticky_widgets )
        {
            filter += "sticky_arr:(backgroundColor::" + colors_arr.join( "|backgroundColor::" ) + ")|";
        }
        filter = filter.replace( /\|$/, "" );
    }
    else
    {
        filter = filter.replace( /\,\s+$/, "" );
    }
    
    var parms_json = { "query" : query, "filter" : filter, "passages" : passages }
    
    document.getElementById( "query_display" ).value = JSON.stringify( parms_json, null, 3 );
    
}


function search()
{
    var parms_json_str = document.getElementById( "query_display" ).value;
    
    document.getElementById( "search_raw_results_div" ).innerHTML = "<div id='raw_results_spinner' class='spinner_dark'></div>";
    document.getElementById( "search_results_div"     ).innerHTML = "<div id='results_spinner' class='spinner_dark'></div>";
    
    $.ajax( { url      : "./search",
              type     : "POST",
              dataType : "json",
              contentType: "application/json",
              data     : parms_json_str,
              complete : function( result )
                         {
                             document.getElementById( "search_raw_results_div" ).innerHTML = "";
                             document.getElementById( "search_results_div"     ).innerHTML = "";
    
                             var result_json = result["responseJSON"];
                             if( !result_json )
                             {
                                 alert( "Unexpected result returned from /search" );
                                 return;
                             }
                             
                             var error_str  = result_json["error_str"];
                             if( error_str )
                             {
                                 alert( "Error returned from /search:\n\n" + error_str );
                                 return;
                             }
                             
                             var raw_results_arr = result_json["results_arr"];
                             document.getElementById( "search_raw_results_div" ).innerHTML = "<pre>" + JSON.stringify( raw_results_arr, null, 3 ) + "</pre>";
                             
                             var formatted_results_arr = result_json["formatted_results_arr"];
                             populateSearchResults( formatted_results_arr );
                             
                         }
                     
        } );

}


function populateSearchResults( formatted_results_arr )
{
    var ul_html = "<ul class='search_results_ul'>";
    var li_html = "";
    for( var i = 0; i < formatted_results_arr.length; i++ )
    {
        li_html = "";
        
        result = formatted_results_arr[i];
        
        workspace_name  = result["workspace_name"]  ? result["workspace_name"]  : "";
        room_name       = result["room_name"]       ? result["room_name"]       : "";
        mural_title     = result["mural_title"]     ? result["mural_title"]     : "";
        mural_link      = result["mural_link"]      ? result["mural_link"]      : "";
        mural_thumbnail = result["mural_thumbnail"] ? result["mural_thumbnail"] : "";
        created         = ( "created" in result )   ? result["created"]         : -1;
        creator         = result["creator"]         ? result["creator"]         : "";
        passages_arr    = result["passages"]        ? result["passages"]        : [];
        
        li_html = "<li";
        li_html += ( i < 1 ) ? " style='border-top: none;'" : "";
        li_html += ">" +
                   "<img src='" + mural_thumbnail + "' />" +
                   "<div class='search_result_container'>" +
                   "<div class='breadcrumbs'>" + workspace_name;
        li_html += room_name ? " <div class='rotated'>&#x2335;</div> " + room_name : "";
        li_html += "<div class='rotated'>&#x2335;</div></div>" +
                   "<a href='" + mural_link + "' target='_other'>" + mural_title + "</a>";
        if( ( -1 !==created ) || creator )
        {
            li_html += "<div class='created_details'>";
            li_html += ( -1 !==created ) ? "( " + dateStr( created ) + " ) " : "";
            li_html += creator ? creator : "";
            li_html += "</div>";
        }
        for( var j=0; j < passages_arr.length; j++ )
        {
            li_html += "<div class='passage'>" + passages_arr[j] + "</div>";
        }
        li_html += "</li>";
        
        ul_html += li_html;
    }
    
    document.getElementById( "search_results_div" ).innerHTML = ul_html;

}


function dateStr( input )
{
    var d = new Date( parseInt( input ) );
    
    var year    = d.getUTCFullYear();
    var month   = myPadZero( d.getUTCMonth() + 1 );
    var day     = myPadZero( d.getUTCDate() );

    var date_str = year + '-' + month + '-' + day;

    return date_str;    
}

function myPadZero( input )
{
	if( input < 10 )
	{
		return "0" + input;
	}
	
	return input;
}
